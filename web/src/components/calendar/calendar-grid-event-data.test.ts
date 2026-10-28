import { describe, expect, it } from 'vitest'

import { mapCalendarGridEvents } from '#components/calendar/calendar-grid-event-data'
import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'

describe('mapCalendarGridEvents', () => {
  it('passes the exception kind to the schedule event content', () => {
    const event = makeTimeBlockEvent({
      id: 'schedule-moved-occurrence',
      title: 'Routine',
      start: '2034-08-18T09:00:00',
      end: '2034-08-18T10:00:00',
      type: 'schedule',
      scheduleId: 'schedule-overlap',
      scheduleOccurrenceDate: '2034-08-17',
      scheduleOverridden: 'moved',
    })

    expect(mapCalendarGridEvents([event], 'day')).toEqual([
      {
        id: 'schedule-moved-occurrence',
        title: 'Routine',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        allDay: false,
        queueOrder: 1,
        queuePosition: undefined,
        displayPriority: 0,
        editable: false,
        durationEditable: true,
        extendedProps: {
          type: 'schedule',
          parentRef: undefined,
          color: undefined,
          taskId: undefined,
          dateTaskKind: undefined,
          dateTaskOverdue: undefined,
          dateTaskDueDateLabel: undefined,
          displayPriority: 0,
          isAutoScheduled: undefined,
          scheduleId: 'schedule-overlap',
          scheduleOccurrenceDate: '2034-08-17',
          scheduleOverridden: 'moved',
          scheduleStart: '2034-08-18T09:00:00',
          queuePosition: undefined,
          redacted: undefined,
          calendarColor: undefined,
          responseStatus: undefined,
          gcalEventType: undefined,
        },
      },
    ])
  })

  it('passes the original occurrence date to schedule click handlers', () => {
    const event = makeTimeBlockEvent({
      id: 'schedule-moved-occurrence',
      title: 'Routine',
      start: '2034-08-18T09:00:00',
      end: '2034-08-18T10:00:00',
      type: 'schedule',
      scheduleId: 'schedule-overlap',
      scheduleOccurrenceDate: '2034-08-17',
    })

    expect(mapCalendarGridEvents([event], 'day')).toEqual([
      {
        id: 'schedule-moved-occurrence',
        title: 'Routine',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        allDay: false,
        queueOrder: 1,
        queuePosition: undefined,
        displayPriority: 0,
        editable: false,
        durationEditable: true,
        extendedProps: {
          type: 'schedule',
          parentRef: undefined,
          color: undefined,
          taskId: undefined,
          dateTaskKind: undefined,
          dateTaskOverdue: undefined,
          dateTaskDueDateLabel: undefined,
          displayPriority: 0,
          isAutoScheduled: undefined,
          scheduleId: 'schedule-overlap',
          scheduleOccurrenceDate: '2034-08-17',
          scheduleStart: '2034-08-18T09:00:00',
          queuePosition: undefined,
          redacted: undefined,
          calendarColor: undefined,
          responseStatus: undefined,
          gcalEventType: undefined,
        },
      },
    ])
  })

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
      hasUnresolvedWait: true,
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
          hasUnresolvedWait: true,
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

  it('passes wait status to timed task event content', () => {
    const event = makeTimeBlockEvent({
      id: 'waiting-time-block',
      title: 'Review a sample outline',
      start: '2031-04-09T10:00:00',
      end: '2031-04-09T11:30:00',
      type: 'manual',
      taskId: 'waiting-task',
      hasUnresolvedWait: true,
    })

    expect(mapCalendarGridEvents([event], 'day')).toEqual([
      {
        id: 'waiting-time-block',
        title: 'Review a sample outline',
        start: '2031-04-09T10:00:00',
        end: '2031-04-09T11:30:00',
        allDay: false,
        queueOrder: 1,
        queuePosition: undefined,
        displayPriority: 0,
        editable: true,
        durationEditable: true,
        extendedProps: {
          type: 'manual',
          parentRef: undefined,
          color: undefined,
          taskId: 'waiting-task',
          dateTaskKind: undefined,
          dateTaskOverdue: undefined,
          dateTaskDueDateLabel: undefined,
          hasUnresolvedWait: true,
          displayPriority: 0,
          isAutoScheduled: undefined,
          scheduleId: undefined,
          scheduleStart: '2031-04-09T10:00:00',
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
