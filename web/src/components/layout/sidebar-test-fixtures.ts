import type { Project } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import type { Task } from '#hooks/use-tasks'

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    number: 1,
    title: 'Implement task list UI',
    description: null,
    status: 'todo',
    context: 'personal',
    commitment: 'active',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    githubLinks: [],
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
    ...overrides,
  }
}

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
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    completionRate: 0,
    taskCount: { total: 0, completed: 0 },
    ...overrides,
  }
}

export function makeSavedView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: '00000000-0000-0000-0000-000000000201',
    name: 'Now',
    query: 'commitment:active',
    position: 0,
    context: 'personal',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}
