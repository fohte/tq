import { describe, expect, it } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { mapTaskDateCalendarEvents } from '#hooks/task-date-calendar-events'

describe('mapTaskDateCalendarEvents', () => {
  it('maps intersecting task dates to all-day events and excludes unrelated tasks', () => {
    const tasks = [
      makeTask({
        id: 'range-task',
        title: 'Plan a sample launch',
        startDate: '2026-10-02',
        dueDate: '2026-10-09',
      }),
      makeTask({
        id: 'due-task',
        title: 'Send a sample draft',
        dueDate: '2026-10-10',
      }),
      makeTask({
        id: 'start-task',
        title: 'Begin a sample review',
        startDate: '2026-10-04',
      }),
      makeTask({
        id: 'same-date-task',
        title: 'Finish a sample outline',
        startDate: '2026-10-06',
        dueDate: '2026-10-06',
      }),
      makeTask({
        id: 'adjacent-task',
        startDate: '2026-10-01',
        dueDate: '2026-10-03',
      }),
      makeTask({
        id: 'completed-task',
        startDate: '2026-10-06',
        dueDate: '2026-10-07',
        status: 'completed',
      }),
      makeTask({ id: 'undated-task' }),
      makeTask({ id: 'outside-task', dueDate: '2026-10-11' }),
    ]

    expect(
      mapTaskDateCalendarEvents(
        tasks,
        { startDate: '2026-10-04', endDate: '2026-10-10' },
        new Date(2026, 9, 2, 12),
      ),
    ).toEqual([
      {
        id: 'task-date-range-task-range',
        title: 'Plan a sample launch',
        start: '2026-10-02',
        end: '2026-10-10',
        type: 'task-date',
        taskId: 'range-task',
        allDay: true,
        dateTaskKind: 'range',
      },
      {
        id: 'task-date-due-task-due',
        title: 'Send a sample draft',
        start: '2026-10-10',
        end: '2026-10-11',
        type: 'task-date',
        taskId: 'due-task',
        allDay: true,
        dateTaskKind: 'due',
      },
      {
        id: 'task-date-start-task-start',
        title: 'Begin a sample review',
        start: '2026-10-04',
        end: '2026-10-05',
        type: 'task-date',
        taskId: 'start-task',
        allDay: true,
        dateTaskKind: 'start',
      },
      {
        id: 'task-date-same-date-task-range',
        title: 'Finish a sample outline',
        start: '2026-10-06',
        end: '2026-10-07',
        type: 'task-date',
        taskId: 'same-date-task',
        allDay: true,
        dateTaskKind: 'range',
      },
    ])
  })

  it('shows separate date events and a prioritized today reminder when the start date follows the due date', () => {
    const task = makeTask({
      id: 'out-of-order-task',
      title: 'Update a sample plan',
      startDate: '2026-10-08',
      dueDate: '2026-10-03',
    })

    expect(
      mapTaskDateCalendarEvents(
        [task],
        { startDate: '2026-10-01', endDate: '2026-10-10' },
        new Date(2026, 9, 6, 12),
      ),
    ).toEqual([
      {
        id: 'task-date-out-of-order-task-due',
        title: 'Update a sample plan',
        start: '2026-10-03',
        end: '2026-10-04',
        type: 'task-date',
        taskId: 'out-of-order-task',
        allDay: true,
        dateTaskKind: 'due',
        dateTaskOverdue: true,
      },
      {
        id: 'task-date-out-of-order-task-start',
        title: 'Update a sample plan',
        start: '2026-10-08',
        end: '2026-10-09',
        type: 'task-date',
        taskId: 'out-of-order-task',
        allDay: true,
        dateTaskKind: 'start',
      },
      {
        id: 'task-date-out-of-order-task-overdue-today',
        title: 'Update a sample plan',
        start: '2026-10-06',
        end: '2026-10-07',
        type: 'task-date',
        taskId: 'out-of-order-task',
        allDay: true,
        dateTaskKind: 'overdue-today',
        dateTaskOverdue: true,
        dateTaskDueDateLabel: 'Oct 3',
        displayPriority: 1,
      },
    ])
  })

  it('does not add the today reminder when today is outside the visible range', () => {
    const task = makeTask({
      id: 'overdue-task',
      title: 'Review a sample note',
      startDate: '2026-10-01',
      dueDate: '2026-10-04',
    })

    expect(
      mapTaskDateCalendarEvents(
        [task],
        { startDate: '2026-10-01', endDate: '2026-10-05' },
        new Date(2026, 9, 6, 12),
      ),
    ).toEqual([
      {
        id: 'task-date-overdue-task-range',
        title: 'Review a sample note',
        start: '2026-10-01',
        end: '2026-10-05',
        type: 'task-date',
        taskId: 'overdue-task',
        allDay: true,
        dateTaskKind: 'range',
        dateTaskOverdue: true,
      },
    ])
  })
})
