import { asc, desc } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskDescriptionTemplates } from '#db/schema'

type DescriptionSection = { heading: string; content: string[] }

function parseSections(markdown: string): DescriptionSection[] {
  const sections: DescriptionSection[] = []
  let current: DescriptionSection | undefined
  let codeFence: { marker: string; length: number } | undefined

  for (const line of markdown.split(/\r?\n/)) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    const fenceText = fence?.[1]
    const fenceMarker = fenceText?.[0]

    if (codeFence !== undefined) {
      if (
        fenceText !== undefined &&
        fenceMarker === codeFence.marker &&
        fenceText.length >= codeFence.length
      ) {
        codeFence = undefined
        continue
      }
      current?.content.push(line)
      continue
    }
    if (fenceText !== undefined && fenceMarker !== undefined) {
      codeFence = { marker: fenceMarker, length: fenceText.length }
      continue
    }

    const match = line.match(/^\s{0,3}##[ \t]+(.+?)\s*$/)
    if (match?.[1] === undefined) {
      current?.content.push(line)
      continue
    }

    current = {
      heading: match[1].replace(/[ \t]+#+$/, '').trim(),
      content: [],
    }
    sections.push(current)
  }

  return sections
}

function hasSectionContent(section: DescriptionSection): boolean {
  return section.content.some((line) => {
    const content = line.trim()
    return content !== '' && !/^-[ \t]+\[[ \t]*\]$/.test(content)
  })
}

export type TemplateValidationError =
  | {
      kind: 'unknown-template'
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
          templates: templates.map(({ name, whenToUse }) => ({
            name,
            whenToUse,
          })),
        }
  }

  const requiredSections = parseSections(template.body)
  const descriptionSections = parseSections(input.description ?? '')
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
      error: {
        message: JSON.stringify([
          {
            path: ['template'],
            message: [
              'Unknown description template. Choose an available template:',
              ...(choices.length > 0
                ? choices
                : ['No description templates are configured.']),
            ].join('\n'),
          },
        ]),
      },
      templates: validation.templates,
    }
  }

  const issues = [
    ...validation.missingSections.map((section) => `${section} is missing.`),
    ...validation.emptySections.map((section) => `${section} is empty.`),
  ].map((message) => ({
    path: ['description'],
    message: `${message}\nGuide:\n${validation.guide}\nFill the section and call task_create again.`,
  }))

  return {
    error: { message: JSON.stringify(issues) },
    missingSections: validation.missingSections,
    emptySections: validation.emptySections,
    guide: validation.guide,
  }
}
