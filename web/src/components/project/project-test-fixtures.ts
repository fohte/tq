import type { ProjectField } from '#hooks/use-project-fields'
import type { Project, ProjectDetail } from '#hooks/use-projects'

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: '00000000-0000-0000-0000-000000000101',
    title: 'tq',
    description: null,
    status: 'active',
    startDate: null,
    targetDate: null,
    color: null,
    sortOrder: 0,
    context: 'personal',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    completionRate: 0,
    taskCount: { total: 0, completed: 0 },
    ...overrides,
  }
}

export function makeProjectDetail(
  overrides: Partial<ProjectDetail> = {},
): ProjectDetail {
  return makeProject(overrides)
}

type ProjectFieldOption = ProjectField['options'][number]

export function makeProjectFieldOption(
  overrides: Partial<ProjectFieldOption> = {},
): ProjectFieldOption {
  return {
    id: 'option-example',
    name: 'ExampleChoice',
    ...overrides,
  }
}

export function makeProjectField(
  overrides: Partial<ProjectField> = {},
): ProjectField {
  return {
    id: 'field-a',
    projectId: 'project-a',
    name: 'SampleCategory',
    type: 'single_select',
    options: [
      makeProjectFieldOption({ id: 'option-a', name: 'OptionA' }),
      makeProjectFieldOption({ id: 'option-b', name: 'OptionB' }),
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
