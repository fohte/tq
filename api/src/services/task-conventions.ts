import type { Node } from '@milkdown/kit/prose/model'
import { asc, desc, eq } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskDescriptionTemplates } from '#db/schema'
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

function collectUncheckedCompletionCriteriaFromText(
  markdown: string,
): string[] {
  const items: string[] = []
  let codeFence: { marker: string; length: number } | undefined

  for (const line of markdown.split(/\r?\n/)) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/)
    const fenceText = fence?.[1]
    const fenceMarker = fenceText?.[0]

    if (codeFence !== undefined) {
      const closingFence = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)?.[1]
      if (
        closingFence !== undefined &&
        closingFence[0] === codeFence.marker &&
        closingFence.length >= codeFence.length
      ) {
        codeFence = undefined
      }
      continue
    }

    if (fenceText !== undefined && fenceMarker !== undefined) {
      codeFence = { marker: fenceMarker, length: fenceText.length }
      continue
    }

    if (/^(?: {4,}|\t)/.test(line)) continue

    const match = line.match(/^ {0,3}([-*])[ \t]+\[ \](?:[ \t]+(.*))?$/)
    if (match === null) continue

    const bullet = match[1]
    if (bullet === undefined) continue

    const text = match[2]?.trim() ?? ''
    items.push(text === '' ? `${bullet} [ ]` : `${bullet} [ ] ${text}`)
  }

  return items
}

export async function checkTaskComplete(
  author: Author,
  task: { description: string | null },
  statusReason: TaskStatusReason | undefined,
): Promise<TaskConventionViolation | null> {
  if (
    !appliesTaskConventions(author) ||
    statusReason !== 'completed' ||
    task.description === null
  ) {
    return null
  }

  const parsed = await parseMarkdown(task.description)
  // Keep the guard closed when the Markdown parser cannot read the description.
  const items = parsed.isErr()
    ? collectUncheckedCompletionCriteriaFromText(task.description)
    : collectUncheckedCompletionCriteria(parsed.value)
  return items.length === 0
    ? null
    : { kind: 'unchecked-completion-criteria', items }
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
    return {
      error: [
        'Unchecked completion criteria:',
        ...violation.items,
        'Check off each verified item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
      ].join('\n'),
      uncheckedCompletionCriteria: violation.items,
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
