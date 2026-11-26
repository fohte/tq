import type { ProjectField } from '#hooks/use-project-fields'

export function makeProjectField(
  overrides: Partial<ProjectField> = {},
): ProjectField {
  return {
    id: 'field-a',
    projectId: 'project-a',
    name: 'SampleCategory',
    type: 'single_select',
    options: [
      { id: 'option-a', name: 'OptionA' },
      { id: 'option-b', name: 'OptionB' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
