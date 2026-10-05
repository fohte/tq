import {
  type DescriptionSection,
  parseDescriptionTemplateSections,
} from '#routes/tasks/description-template-sections'

export type DescriptionTemplateSectionViolation = {
  missingSections: string[]
  emptySections: string[]
  guide: string
}

function hasSectionContent(section: DescriptionSection): boolean {
  return section.content.some((line) => {
    const content = line.trim()
    return content !== '' && !/^-[ \t]+\[[ \t]*\]$/.test(content)
  })
}

export function validateTaskDescriptionTemplate(
  template: { body: string; guide: string },
  description?: string | null,
): DescriptionTemplateSectionViolation | null {
  const requiredSections = parseDescriptionTemplateSections(template.body)
  const descriptionSections = parseDescriptionTemplateSections(
    description ?? '',
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
        missingSections,
        emptySections,
        guide: template.guide,
      }
}
