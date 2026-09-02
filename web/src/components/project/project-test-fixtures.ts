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
