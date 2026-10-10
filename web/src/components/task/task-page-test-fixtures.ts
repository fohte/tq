import type { TaskPage, TaskPageBody } from '#hooks/use-task-pages'

const defaultPageMetadata = {
  id: 'page-001',
  taskId: 'task-001',
  title: 'Meeting Notes',
  format: 'markdown' as const,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  author: null,
}

const defaultPageContent =
  '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B.'

export function makeTaskPage(overrides: Partial<TaskPage> = {}): TaskPage {
  const format = overrides.format ?? 'markdown'

  return {
    ...defaultPageMetadata,
    preview: format === 'markdown' ? defaultPageContent.slice(0, 500) : null,
    contentTruncated: false,
    ...overrides,
  }
}

export function makeTaskPageBody(
  overrides: Partial<TaskPageBody> = {},
): TaskPageBody {
  return {
    ...defaultPageMetadata,
    content: defaultPageContent,
    ...overrides,
  }
}
