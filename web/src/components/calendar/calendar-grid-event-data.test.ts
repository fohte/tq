import { describe, expect, it } from 'vitest'

import { mapCalendarGridEvents } from '#components/calendar/calendar-grid-event-data'
import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'

describe('mapCalendarGridEvents', () => {
  it('preserves all-day, read-only, and priority metadata for task-date reminders', () => {
    const event = makeTimeBlockEvent({
      id: 'task-date-reminder',
      title: 'Review a sample note',
      start: '2026-10-06',
      end: '2026-10-07',
      type: 'task-date',
      taskId: 'sample-task',
      allDay: true,
      dateTaskKind: 'overdue-today',
      dateTaskOverdue: true,
      dateTaskDueDateLabel: 'Oct 3',
      displayPriority: 1,
    })

    expect(mapCalendarGridEvents([event], 'day')).toEqual([
      {
        id: 'task-date-reminder',
        title: 'Review a sample note',
        start: '2026-10-06',
        end: '2026-10-07',
        allDay: true,
        displayPriority: 1,
        queueOrder: 1,
        queuePosition: undefined,
        editable: false,
        durationEditable: true,
        extendedProps: {
          type: 'task-date',
          parentRef: undefined,
          color: undefined,
          taskId: 'sample-task',
          dateTaskKind: 'overdue-today',
          dateTaskOverdue: true,
          dateTaskDueDateLabel: 'Oct 3',
          displayPriority: 1,
          isAutoScheduled: undefined,
          scheduleId: undefined,
          scheduleStart: '2026-10-06',
          queuePosition: undefined,
          redacted: undefined,
          calendarColor: undefined,
          responseStatus: undefined,
          gcalEventType: undefined,
        },
      },
    ])
  })
})
