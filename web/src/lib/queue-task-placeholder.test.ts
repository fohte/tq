import { describe, expect, it } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { selectQueueTaskPlaceholderData } from '#lib/queue-task-placeholder'

describe('selectQueueTaskPlaceholderData', () => {
  it('keeps only current queue tasks in queue order', () => {
    const taskA = makeTask({ id: 'task-a' })
    const taskB = makeTask({ id: 'task-b' })

    expect(
      selectQueueTaskPlaceholderData(
        [taskA, taskB],
        {
          ids: ['task-a', 'task-b'],
          context: 'work',
          status: 'all',
          limit: 'unlimited',
        },
        ['task-b', 'task-c', 'task-a'],
        'work',
      ),
    ).toEqual([taskB, taskA])
  })

  it('drops previous queue data when the context changes', () => {
    const task = makeTask({ id: 'task-a' })

    expect(
      selectQueueTaskPlaceholderData(
        [task],
        {
          ids: ['task-a'],
          context: 'work',
          status: 'all',
          limit: 'unlimited',
        },
        ['task-a'],
        'personal',
      ),
    ).toEqual(undefined)
  })

  it('does not reuse an unfiltered task list as queue placeholder data', () => {
    const task = makeTask({ id: 'task-a' })

    expect(
      selectQueueTaskPlaceholderData(
        [task],
        {
          context: 'work',
          status: 'all',
          limit: 'unlimited',
        },
        ['task-a'],
        'work',
      ),
    ).toEqual(undefined)
  })
})
