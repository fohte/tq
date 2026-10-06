import { describe, expect, it } from 'vitest'

import {
  buildCompactQueueSections,
  buildQueueSections,
  DUE_TODAY_SECTION_KEY,
  filterTasksDueOnOrBeforeToday,
  findWritableQueueSection,
} from '#components/day-view/queue-sections'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeQueue } from '#hooks/queue-test-fixtures'
import {
  DAY_QUEUE_KEY,
  type Queue,
  type QueueItem,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'

function transition<T>(before: T, after: T) {
  return { before, after }
}

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
      makeQueue({ name: 'Today' }),
      makeQueue({
        key: 'backlog',
        name: 'Backlog',
        periodUnit: null,
        position: 1,
      }),
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

  it('orders day and week queues by due date while preserving source order for ties and missing dates', () => {
    const dayNoDueFirst = makeTask({ id: 'day-no-due-first' })
    const dayLater = makeTask({ id: 'day-later', dueDate: '2026-08-03' })
    const daySameDueFirst = makeTask({
      id: 'day-same-due-first',
      dueDate: '2026-08-01',
    })
    const dayEarlier = makeTask({ id: 'day-earlier', dueDate: '2026-07-30' })
    const daySameDueSecond = makeTask({
      id: 'day-same-due-second',
      dueDate: '2026-08-01',
    })
    const dayNoDueSecond = makeTask({ id: 'day-no-due-second' })
    const weekNoDue = makeTask({ id: 'week-no-due' })
    const weekLater = makeTask({ id: 'week-later', dueDate: '2026-08-04' })
    const weekEarlier = makeTask({ id: 'week-earlier', dueDate: '2026-07-31' })
    const tasks = [
      dayNoDueFirst,
      dayLater,
      daySameDueFirst,
      dayEarlier,
      daySameDueSecond,
      dayNoDueSecond,
      weekNoDue,
      weekLater,
      weekEarlier,
    ]
    const taskMap = new Map(tasks.map((task) => [task.id, task]))
    const queues: Queue[] = [
      makeQueue({ name: 'Today' }),
      makeQueue({
        key: WEEK_QUEUE_KEY,
        name: 'This week',
        periodUnit: 'week',
        position: 1,
      }),
    ]
    const rawItemsByKey = new Map<string, QueueItem[]>([
      [
        DAY_QUEUE_KEY,
        [
          dayNoDueFirst,
          dayLater,
          daySameDueFirst,
          dayEarlier,
          daySameDueSecond,
          dayNoDueSecond,
        ].map((task, sortOrder) =>
          makeQueueItem({ taskId: task.id, sortOrder }),
        ),
      ],
      [
        WEEK_QUEUE_KEY,
        [weekNoDue, weekLater, weekEarlier].map((task, sortOrder) =>
          makeQueueItem({ taskId: task.id, sortOrder }),
        ),
      ],
    ])

    expect(
      buildQueueSections(queues, rawItemsByKey, taskMap, new Date(2026, 6, 30)),
    ).toEqual([
      {
        key: DAY_QUEUE_KEY,
        title: 'Today',
        items: [
          dayEarlier,
          daySameDueFirst,
          daySameDueSecond,
          dayLater,
          dayNoDueFirst,
          dayNoDueSecond,
        ],
        dateRangeLabel: '07-30',
        emptyMessage: "No tasks in Today's queue",
      },
      {
        key: WEEK_QUEUE_KEY,
        title: 'This week',
        items: [weekEarlier, weekLater, weekNoDue],
        dateRangeLabel: '07-27 – 08-02',
        emptyMessage: "No tasks in This week's queue",
      },
    ])
  })

  it('keeps sortOrder as the tie-break after a due date changes without queue refetch', () => {
    const taskA = makeTask({ id: 'task-a', dueDate: '2026-08-01' })
    const taskB = makeTask({ id: 'task-b', dueDate: '2026-07-31' })
    const taskMap = new Map<string, Task>([
      [taskA.id, taskA],
      [taskB.id, taskB],
    ])
    const queues: Queue[] = [makeQueue({ name: 'Today' })]
    const rawItemsByKey = new Map<string, QueueItem[]>([
      [
        DAY_QUEUE_KEY,
        [
          makeQueueItem({ taskId: taskB.id, sortOrder: 1 }),
          makeQueueItem({ taskId: taskA.id, sortOrder: 0 }),
        ],
      ],
    ])
    const selectedDate = new Date(2026, 6, 30)
    const updatedTaskA = { ...taskA, dueDate: '2026-07-31' }
    const beforeUpdate = buildQueueSections(
      queues,
      rawItemsByKey,
      taskMap,
      selectedDate,
    )
    taskMap.set(taskA.id, updatedTaskA)
    const afterUpdate = buildQueueSections(
      queues,
      rawItemsByKey,
      taskMap,
      selectedDate,
    )

    expect(transition(beforeUpdate, afterUpdate)).toEqual({
      before: [
        {
          key: DAY_QUEUE_KEY,
          title: 'Today',
          items: [taskB, taskA],
          dateRangeLabel: '07-30',
          emptyMessage: "No tasks in Today's queue",
        },
      ],
      after: [
        {
          key: DAY_QUEUE_KEY,
          title: 'Today',
          items: [updatedTaskA, taskB],
          dateRangeLabel: '07-30',
          emptyMessage: "No tasks in Today's queue",
        },
      ],
    })
  })
})

describe('compact queue sections', () => {
  it('includes tasks due on or before today while excluding later and undated tasks', () => {
    const overdueTask = makeTask({ id: 'overdue', dueDate: '2026-07-29' })
    const dueTodayTask = makeTask({ id: 'due-today', dueDate: '2026-07-30' })
    const futureTask = makeTask({ id: 'future', dueDate: '2026-07-31' })
    const undatedTask = makeTask({ id: 'undated' })

    expect(
      filterTasksDueOnOrBeforeToday(
        [overdueTask, dueTodayTask, futureTask, undatedTask],
        '2026-07-30',
      ),
    ).toEqual([overdueTask, dueTodayTask])
  })

  it('does not resolve a read-only section as a drop target', () => {
    const dueTask = makeTask({ id: 'due' })
    const section = {
      key: DUE_TODAY_SECTION_KEY,
      title: 'due today',
      items: [dueTask],
      emptyMessage: 'No tasks due today',
      isReadOnly: true,
    }

    expect(findWritableQueueSection([section], DUE_TODAY_SECTION_KEY)).toEqual(
      undefined,
    )
  })

  it('does not resolve a task in a read-only section as a drop target', () => {
    const dueTask = makeTask({ id: 'due' })
    const section = {
      key: DUE_TODAY_SECTION_KEY,
      title: 'due today',
      items: [dueTask],
      emptyMessage: 'No tasks due today',
      isReadOnly: true,
    }

    expect(findWritableQueueSection([section], dueTask.id)).toEqual(undefined)
  })

  it('shows due tasks first and removes their duplicates from the day queue', () => {
    const dueTask = makeTask({ id: 'due' })
    const dayTask = makeTask({ id: 'day' })

    expect(
      buildCompactQueueSections(
        [
          {
            key: DAY_QUEUE_KEY,
            title: 'today',
            items: [dueTask, dayTask],
            dateRangeLabel: '07-30',
            emptyMessage: "No tasks in today's queue",
          },
          {
            key: 'week',
            title: 'this week',
            items: [],
            emptyMessage: "No tasks in this week's queue",
          },
        ],
        [dueTask],
      ),
    ).toEqual([
      {
        key: DUE_TODAY_SECTION_KEY,
        title: 'due today',
        items: [dueTask],
        emptyMessage: 'No tasks due today',
        isReadOnly: true,
      },
      {
        key: DAY_QUEUE_KEY,
        title: 'today',
        items: [dayTask],
        dateRangeLabel: '07-30',
        emptyMessage: "No tasks in today's queue",
      },
    ])
  })
})
