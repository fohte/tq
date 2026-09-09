import type { QueueItem } from '#hooks/use-queues'

export function makeQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'queue-item-1',
    taskId: 'task-1',
    periodStart: '2026-07-30',
    sortOrder: 0,
    createdAt: '2026-07-30T09:00:00.000Z',
    updatedAt: '2026-07-30T09:00:00.000Z',
    ...overrides,
  }
}
