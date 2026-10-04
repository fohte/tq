import { asc, desc } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskDescriptionTemplates } from '#db/schema'
import {
  type DescriptionSection,
  parseDescriptionTemplateSections,
} from '#routes/tasks/description-template-sections'

function hasSectionContent(section: DescriptionSection): boolean {
  return section.content.some((line) => {
    const content = line.trim()
    return content !== '' && !/^-[ \t]+\[[ \t]*\]$/.test(content)
  })
}

export type TemplateValidationError =
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

export async function validateTaskDescriptionTemplate(input: {
  template?: string | undefined
  description?: string | undefined
}): Promise<TemplateValidationError | null> {
  const templates = await db
    .select()
    .from(taskDescriptionTemplates)
    .orderBy(
      desc(taskDescriptionTemplates.isDefault),
      asc(taskDescriptionTemplates.name),
    )

  const template =
    input.template === undefined
      ? templates.find((candidate) => candidate.isDefault)
      : templates.find((candidate) => candidate.name === input.template)

  if (template === undefined) {
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

  const requiredSections = parseDescriptionTemplateSections(template.body)
  const descriptionSections = parseDescriptionTemplateSections(
    input.description ?? '',
  )
  const missingSections = requiredSections
    .filter(
      ({ heading }) =>
        !descriptionSections.some((section) => section.heading === heading),
    )
    .map(({ heading }) => `## ${heading}`)
  const emptySections = requiredSections
    .filter(
      ({ heading }) =>
        descriptionSections.some((section) => section.heading === heading) &&
        !descriptionSections.some(
          (section) =>
            section.heading === heading && hasSectionContent(section),
        ),
    )
    .map(({ heading }) => `## ${heading}`)

  return missingSections.length === 0 && emptySections.length === 0
    ? null
    : {
        kind: 'invalid-description',
        missingSections,
        emptySections,
        guide: template.guide,
      }
}

export function taskDescriptionTemplateErrorBody(
  validation: TemplateValidationError,
) {
  if (validation.kind === 'unknown-template') {
    const choices = validation.templates.map(
      ({ name, whenToUse }) => `- ${name} (use when: ${whenToUse})`,
    )
    return {
      error: [
        `Unknown description template "${validation.template}".`,
        ...(choices.length > 0
          ? ['Available description templates:', ...choices]
          : ['No description templates are configured.']),
      ].join('\n'),
      templates: validation.templates,
    }
  }

  return {
    error: [
      ...(validation.missingSections.length > 0
        ? [`Missing sections: ${validation.missingSections.join(', ')}.`]
        : []),
      ...(validation.emptySections.length > 0
        ? [`Empty sections: ${validation.emptySections.join(', ')}.`]
        : []),
      `Guide:\n${validation.guide}`,
      'Fill the sections and retry task creation.',
    ].join('\n'),
    missingSections: validation.missingSections,
    emptySections: validation.emptySections,
    guide: validation.guide,
  }
}
