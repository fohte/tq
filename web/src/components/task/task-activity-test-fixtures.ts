import { makeAuthorInfo } from '#components/task/task-author-test-fixtures'
import type { ActivityItem } from '#hooks/use-task-activity'
import type { Comment } from '#hooks/use-task-comments'

type CreatedEvent = Extract<ActivityItem, { type: 'created' }>
type StatusChangedEvent = Extract<ActivityItem, { type: 'status_changed' }>
type GithubLinkedEvent = Extract<
  ActivityItem,
  { type: 'github_linked' | 'github_unlinked' }
>

export function makeCreatedEvent(
  overrides: Partial<CreatedEvent> = {},
): CreatedEvent {
  return {
    id: 'event-created',
    type: 'created',
    createdAt: '2026-03-20T08:00:00.000Z',
    author: makeAuthorInfo(),
    ...overrides,
  }
}

export function makeStatusChangedEvent(
  overrides: Partial<StatusChangedEvent> = {},
): StatusChangedEvent {
  return {
    id: 'event-status',
    type: 'status_changed',
    createdAt: '2026-03-20T09:00:00.000Z',
    author: makeAuthorInfo(),
    fromStatus: 'todo',
    toStatus: 'in_progress',
    toStatusReason: null,
    ...overrides,
  }
}

export function makeGithubLinkedEvent(
  overrides: Partial<GithubLinkedEvent> = {},
): GithubLinkedEvent {
  return {
    id: 'event-linked',
    type: 'github_linked',
    createdAt: '2026-03-20T09:30:00.000Z',
    author: makeAuthorInfo(),
    owner: 'sample-owner',
    repo: 'sample-repo',
    number: 42,
    kind: 'issue',
    ...overrides,
  }
}

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
