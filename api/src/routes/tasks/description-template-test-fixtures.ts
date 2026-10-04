import { taskDescriptionTemplates } from '#db/schema'

type DescriptionTemplateInsert = typeof taskDescriptionTemplates.$inferInsert

export function makeDescriptionTemplate(
  overrides: Partial<DescriptionTemplateInsert> = {},
): DescriptionTemplateInsert {
  return {
    name: 'fixture-template',
    whenToUse: 'Use for a test task',
    body: '## Goal',
    guide: 'Describe the goal.',
    isDefault: false,
    ...overrides,
  }
}
