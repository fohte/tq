import { describe, expect, it } from 'vitest'

import { buildQueueSections } from '#components/day-view/queue-sections'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { DAY_QUEUE_KEY, type Queue, type QueueItem } from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'

describe('buildQueueSections', () => {
  it('keeps completed tasks in the day queue and hides them in other queues', () => {
    const openTask = makeTask({ id: 'task-open' })
    const completedTask = makeTask({
      id: 'task-completed',
      status: 'completed',
    })
    const taskMap = new Map<string, Task>([
      [openTask.id, openTask],
      [completedTask.id, completedTask],
    ])
    const queues: Queue[] = [
      { key: DAY_QUEUE_KEY, name: 'Today', periodUnit: 'day', position: 0 },
      { key: 'backlog', name: 'Backlog', periodUnit: null, position: 1 },
    ]
    const rawItemsByKey = new Map<string, QueueItem[]>([
      [
        DAY_QUEUE_KEY,
        [
          makeQueueItem({ taskId: openTask.id }),
          makeQueueItem({ taskId: completedTask.id }),
          makeQueueItem({ taskId: 'task-missing' }),
        ],
      ],
      [
        'backlog',
        [
          makeQueueItem({ taskId: completedTask.id }),
          makeQueueItem({ taskId: openTask.id }),
        ],
      ],
    ])

    expect(
      buildQueueSections(queues, rawItemsByKey, taskMap, new Date(2026, 6, 30)),
    ).toEqual([
      {
        key: DAY_QUEUE_KEY,
        title: 'Today',
        items: [openTask, completedTask],
        dateRangeLabel: '07-30',
        emptyMessage: "No tasks in Today's queue",
      },
      {
        key: 'backlog',
        title: 'Backlog',
        items: [openTask],
        emptyMessage: "No tasks in Backlog's queue",
      },
    ])
  })

  it('returns no sections before queues load', () => {
    expect(
      buildQueueSections(
        undefined,
        new Map(),
        new Map(),
        new Date(2026, 6, 30),
      ),
    ).toEqual([])
  })
})
