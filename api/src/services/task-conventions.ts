import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { Node } from '@milkdown/kit/prose/model'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db, type DbTransaction } from '#db/connection'
import {
  taskChecklistItems,
  taskChecklists,
  taskDescriptionTemplates,
} from '#db/schema'
import type { Author } from '#lib/author'
import { parseMarkdown } from '#lib/markdown-parser'
import { validateTaskDescriptionTemplate } from '#routes/tasks/description-template-validation'
import type { TaskStatusReason } from '#schemas/task'

export type TaskConventionViolation =
  | {
      kind: 'unknown-template'
      template: string
      templates: { name: string; whenToUse: string }[]
    }
  | {
      kind: 'invalid-description'
      missingSections: string[]
      emptySections: string[]
      guide: string
    }
  | {
      kind: 'unchecked-completion-criteria'
      items: string[]
      descriptionParseFailed: boolean
      uncheckedChecklistItems: UncheckedChecklistItem[]
    }

type UncheckedChecklistItem = {
  id: string
  checklistName: string | null
  content: string
}

type DescriptionTemplate = typeof taskDescriptionTemplates.$inferSelect

export type TaskCreateTemplateSelection = {
  requestedName: string | undefined
  selected: DescriptionTemplate | undefined
  templates: DescriptionTemplate[]
}

async function findCreateTemplate(templateName?: string): Promise<{
  selected: DescriptionTemplate | undefined
  templates: DescriptionTemplate[]
}> {
  const templates = await db
    .select()
    .from(taskDescriptionTemplates)
    .orderBy(
      desc(taskDescriptionTemplates.isDefault),
      asc(taskDescriptionTemplates.name),
    )

  return {
    selected:
      templateName === undefined
        ? templates.find((template) => template.isDefault)
        : templates.find((template) => template.name === templateName),
    templates,
  }
}

function descriptionViolation(
  template: DescriptionTemplate,
  description?: string | null,
): TaskConventionViolation | null {
  const violation = validateTaskDescriptionTemplate(template, description)
  return violation === null
    ? null
    : { kind: 'invalid-description', ...violation }
}

function appliesTaskConventions(author: Author): boolean {
  // Humans can write freely, while LLMs often drift into unstructured notes; the API keeps LLM-authored tasks within the expected format.
  return author.kind === 'llm'
}

export async function resolveTaskCreateTemplate(
  author: Author,
  input: { template?: string | undefined },
): Promise<TaskCreateTemplateSelection | null> {
  if (!appliesTaskConventions(author)) return null

  const { selected, templates } = await findCreateTemplate(input.template)
  return { requestedName: input.template, selected, templates }
}

export function checkTaskCreate(
  author: Author,
  input: {
    template: TaskCreateTemplateSelection | null
    description?: string | undefined
  },
): TaskConventionViolation | null {
  if (!appliesTaskConventions(author) || input.template === null) return null

  const { requestedName, selected, templates } = input.template
  if (selected === undefined) {
    return requestedName === undefined
      ? null
      : {
          kind: 'unknown-template',
          template: requestedName,
          templates: templates.map(({ name, whenToUse }) => ({
            name,
            whenToUse,
          })),
        }
  }

  return descriptionViolation(selected, input.description)
}

export async function checkTaskUpdate(
  author: Author,
  task: { descriptionTemplateId: string | null },
  update: { description?: string | null | undefined },
): Promise<TaskConventionViolation | null> {
  if (
    !appliesTaskConventions(author) ||
    !Object.hasOwn(update, 'description') ||
    task.descriptionTemplateId === null
  ) {
    return null
  }

  const template = await db.query.taskDescriptionTemplates.findFirst({
    where: eq(taskDescriptionTemplates.id, task.descriptionTemplateId),
  })
  return template === undefined
    ? null
    : descriptionViolation(template, update.description)
}

function collectUncheckedCompletionCriteria(node: Node): string[] {
  const items: string[] = []
  node.descendants((descendant) => {
    if (
      descendant.type.name !== 'list_item' ||
      descendant.attrs['checked'] !== false
    ) {
      return
    }

    const paragraphs: string[] = []
    descendant.forEach((child) => {
      if (child.type.name === 'paragraph') paragraphs.push(child.textContent)
    })

    const text = paragraphs.join('\n').trim()
    items.push(text === '' ? '- [ ]' : `- [ ] ${text}`)
  })
  return items
}

export async function checkTaskComplete(
  author: Author,
  task: { id: string; description: string | null },
  statusReason: TaskStatusReason | undefined,
  tx: DbTransaction,
): Promise<TaskConventionViolation | null> {
  if (!appliesTaskConventions(author) || statusReason !== 'completed') {
    return null
  }

  const children = alias(taskChecklistItems, 'checklist_child')
  const uncheckedChecklistItems = await tx
    .select({
      id: taskChecklistItems.id,
      checklistName: taskChecklists.name,
      content: taskChecklistItems.content,
    })
    .from(taskChecklistItems)
    .innerJoin(
      taskChecklists,
      eq(taskChecklists.id, taskChecklistItems.checklistId),
    )
    .leftJoin(
      children,
      and(
        eq(children.checklistId, taskChecklistItems.checklistId),
        eq(children.parentItemId, taskChecklistItems.id),
      ),
    )
    .where(
      and(
        eq(taskChecklists.taskId, task.id),
        isNull(taskChecklistItems.checkedAt),
        isNull(children.id),
      ),
    )
    .orderBy(
      asc(taskChecklists.sortOrder),
      asc(taskChecklists.createdAt),
      asc(taskChecklists.id),
      asc(taskChecklistItems.sortOrder),
      asc(taskChecklistItems.createdAt),
      asc(taskChecklistItems.id),
    )

  let items: string[] = []
  let descriptionParseFailed = false
  if (task.description !== null) {
    const parsed = await parseMarkdown(task.description)
    if (parsed.isErr()) {
      captureWithFingerprint(
        parsed.error,
        'api.task-conventions.completion-parse-failed',
      )
      descriptionParseFailed = true
    } else {
      items = collectUncheckedCompletionCriteria(parsed.value)
    }
  }

  return items.length === 0 &&
    !descriptionParseFailed &&
    uncheckedChecklistItems.length === 0
    ? null
    : {
        kind: 'unchecked-completion-criteria',
        items,
        descriptionParseFailed,
        uncheckedChecklistItems,
      }
}

export function taskConventionViolationBody(
  violation: TaskConventionViolation,
  operation: 'creation' | 'update' | 'completion',
) {
  if (violation.kind === 'unknown-template') {
    const choices = violation.templates.map(
      ({ name, whenToUse }) => `- ${name} (use when: ${whenToUse})`,
    )
    return {
      error: [
        `Unknown description template "${violation.template}".`,
        ...(choices.length > 0
          ? ['Available description templates:', ...choices]
          : ['No description templates are configured.']),
      ].join('\n'),
      templates: violation.templates,
    }
  }

  if (violation.kind === 'unchecked-completion-criteria') {
    const hasDescriptionCriteria = violation.items.length > 0
    const hasChecklistItems = violation.uncheckedChecklistItems.length > 0
    const instructions = [
      ...(violation.descriptionParseFailed
        ? [
            'Simplify the description and verify its criteria before completing the task, or close it with statusReason "not_planned".',
          ]
        : []),
      ...(hasDescriptionCriteria
        ? [
            'Check off each verified item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
          ]
        : []),
      ...(hasChecklistItems
        ? [
            'Check off each verified checklist item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
          ]
        : []),
    ]
    return {
      error: [
        violation.descriptionParseFailed
          ? 'Could not inspect completion criteria because the description could not be parsed as Markdown.'
          : hasDescriptionCriteria
            ? 'Unchecked completion criteria:'
            : null,
        ...violation.items,
        ...(hasChecklistItems
          ? [
              'Unchecked checklist items:',
              ...violation.uncheckedChecklistItems.map(
                ({ checklistName, content }) =>
                  `- ${checklistName ?? 'Checklist'}: ${content}`,
              ),
            ]
          : []),
        ...instructions,
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
      uncheckedCompletionCriteria: violation.items,
      ...(hasChecklistItems
        ? { uncheckedChecklistItems: violation.uncheckedChecklistItems }
        : {}),
    }
  }

  const retryInstruction =
    operation === 'creation'
      ? 'Fill the sections and retry task creation.'
      : 'Fill the sections and retry the task update.'

  return {
    error: [
      ...(violation.missingSections.length > 0
        ? [`Missing sections: ${violation.missingSections.join(', ')}.`]
        : []),
      ...(violation.emptySections.length > 0
        ? [`Empty sections: ${violation.emptySections.join(', ')}.`]
        : []),
      `Guide:\n${violation.guide}`,
      retryInstruction,
    ].join('\n'),
    missingSections: violation.missingSections,
    emptySections: violation.emptySections,
    guide: violation.guide,
  }
}
