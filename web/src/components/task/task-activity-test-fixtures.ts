import type { Comment } from '#hooks/use-task-comments'

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  const timestamp = new Date(Date.now() - 3_600_000).toISOString()

  return {
    id: 'comment-1',
    taskId: 'task-1',
    content: 'A sample comment.',
    createdAt: timestamp,
    updatedAt: timestamp,
    author: null,
    ...overrides,
  }
}
