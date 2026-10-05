import { asc, desc, eq } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskDescriptionTemplates } from '#db/schema'
import type { Author } from '#lib/author'
import { validateTaskDescriptionTemplate } from '#routes/tasks/description-template-validation'

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

type DescriptionTemplate = typeof taskDescriptionTemplates.$inferSelect

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

export async function checkTaskCreate(
  author: Author,
  input: { template?: string | undefined; description?: string | undefined },
): Promise<TaskConventionViolation | null> {
  if (!appliesTaskConventions(author)) return null

  const { selected, templates } = await findCreateTemplate(input.template)
  if (selected === undefined) {
    return input.template === undefined
      ? null
      : {
          kind: 'unknown-template',
          template: input.template,
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

export async function taskDescriptionTemplateIdForCreate(
  author: Author,
  input: { template?: string | undefined },
): Promise<string | null> {
  if (!appliesTaskConventions(author)) return null
  const { selected } = await findCreateTemplate(input.template)
  return selected?.id ?? null
}

export function taskConventionViolationBody(
  violation: TaskConventionViolation,
  operation: 'creation' | 'update',
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
