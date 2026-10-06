import type {
  TaskChecklist,
  TaskChecklistItem,
} from '#hooks/use-task-checklists'

export function makeTaskChecklist(
  overrides: Partial<TaskChecklist> = {},
): TaskChecklist {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    taskId: '10000000-0000-4000-8000-000000000001',
    name: 'Preparation',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [],
    ...overrides,
  }
}

export function makeTaskChecklistItem(
  overrides: Partial<TaskChecklistItem> = {},
): TaskChecklistItem {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    checklistId: '20000000-0000-4000-8000-000000000001',
    parentItemId: null,
    content: 'Pack the essentials',
    note: null,
    checkedAt: null,
    sortOrder: 0,
    githubLinkId: null,
    subtaskId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    children: [],
    ...overrides,
  }
}
