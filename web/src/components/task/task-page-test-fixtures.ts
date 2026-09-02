import type { TaskPage } from '#hooks/use-task-pages'

export function makeTaskPage(overrides: Partial<TaskPage> = {}): TaskPage {
  return {
    id: 'page-001',
    taskId: 'task-001',
    title: 'Meeting Notes',
    content:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B.',
    format: 'markdown',
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    author: null,
    ...overrides,
  }
}
