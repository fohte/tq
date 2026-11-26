import type { ProjectField } from '#hooks/use-project-fields'

export function makeProjectField(
  overrides: Partial<ProjectField> = {},
): ProjectField {
  return {
    id: 'field-a',
    projectId: 'project-a',
    name: '分類サンプル',
    type: 'single_select',
    options: [
      { id: 'option-a', name: '候補 A' },
      { id: 'option-b', name: '候補 B' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
