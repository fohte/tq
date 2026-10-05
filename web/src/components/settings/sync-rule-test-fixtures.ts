import type { SyncRule } from '#hooks/use-github-sync-rules'
import type { Project } from '#hooks/use-projects'

export function makeSyncRule(overrides: Partial<SyncRule> = {}): SyncRule {
  return {
    id: 'rule-test-id',
    scope: 'all',
    org: null,
    repo: null,
    trigger: 'assigned',
    targetProjectId: 'project-1',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export const sampleProjects: Project[] = [
  {
    id: 'project-1',
    title: 'tq',
    description: null,
    status: 'active',
    startDate: null,
    targetDate: null,
    color: '#FF8400',
    sortOrder: 0,
    context: 'personal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completionRate: 0,
    taskCount: { total: 0, completed: 0 },
  },
]
