import type { Task, TreeNode } from '#hooks/use-tasks'

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    number: 1,
    title: 'Task title',
    description: null,
    status: 'todo',
    context: 'personal',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    parentNumber: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
    ...overrides,
  }
}

export function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: 'parent-1',
    number: 1,
    title: 'Parent Task',
    description: null,
    status: 'todo',
    context: 'personal',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    parentNumber: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    children: [],
    childCompletionCount: { completed: 0, total: 0 },
    ...overrides,
  }
}
