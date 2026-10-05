import { describe, expect, it } from 'vitest'

import {
  appendQueueTaskId,
  sortQueueItemsBySortOrder,
} from '#lib/queue-task-order'

describe('sortQueueItemsBySortOrder', () => {
  it('restores queue order when the response array uses due order', () => {
    expect(
      sortQueueItemsBySortOrder([
        { taskId: 'due-first', sortOrder: 1 },
        { taskId: 'due-second', sortOrder: 0 },
      ]),
    ).toEqual([
      { taskId: 'due-second', sortOrder: 0 },
      { taskId: 'due-first', sortOrder: 1 },
    ])
  })
})

describe('appendQueueTaskId', () => {
  it('keeps existing queue order and appends the new task', () => {
    expect(
      appendQueueTaskId(['stored-later', 'stored-earlier'], 'new-task'),
    ).toEqual(['stored-later', 'stored-earlier', 'new-task'])
  })
})
