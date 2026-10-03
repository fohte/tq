import type { DescriptionTemplate } from '#hooks/use-description-templates'

export function makeDescriptionTemplate(
  overrides: Partial<DescriptionTemplate> = {},
): DescriptionTemplate {
  return {
    id: 'description-template-1',
    name: 'General task',
    whenToUse: 'Use for a task with a clear outcome.',
    body: '## Why\n\n## What',
    guide: 'Explain why the task matters and what completion looks like.',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
