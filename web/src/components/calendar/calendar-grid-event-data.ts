import type { EventContentArg } from '@fullcalendar/core'

import type { CalendarViewType } from '#components/calendar/calendar-header'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import {
  type CalendarEventProps,
  getEventProps,
  getGcalEventDetails,
  isClickableEvent,
  isGcalEventType,
} from '#lib/calendar-utils'

export function isCalendarEventClickable(props: CalendarEventProps): boolean {
  return isClickableEvent(props) || getGcalEventDetails(props) != null
}

export function getCalendarGridEventClassNames(arg: EventContentArg): string[] {
  const classNames: string[] = isCalendarEventClickable(
    getEventProps(arg.event),
  )
    ? ['tq-event-clickable']
    : []

  if (arg.event.allDay && !arg.isStart) {
    classNames.push('tq-all-day-continues-left')
  }
  if (arg.event.allDay && !arg.isEnd) {
    classNames.push('tq-all-day-continues-right')
  }

  return classNames
}

export function mapCalendarGridEvents(
  events: TimeBlockEvent[],
  activeView: CalendarViewType,
) {
  return events.map((event) => {
    const gcalDetails = getGcalEventDetails(event)
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay === true,
      displayPriority: event.displayPriority ?? 0,
      editable:
        event.type !== 'schedule' &&
        event.type !== 'task-date' &&
        !isGcalEventType(event.type) &&
        event.redacted !== true,
      // Status events (out of office / focus time) render as a background
      // band instead of a lane card, so they don't crowd out meetings and
      // task blocks. Month view has no time slots to render a band into
      // (FullCalendar only draws timed background events in TimeGrid views),
      // so it keeps rendering them as the regular month pill.
      ...(event.type === 'gcal-status' && activeView !== 'month'
        ? { display: 'background' as const }
        : {}),
      extendedProps: {
        type: event.type,
        parentRef: event.parentRef,
        color: event.color,
        taskId: event.taskId,
        dateTaskKind: event.dateTaskKind,
        dateTaskOverdue: event.dateTaskOverdue,
        dateTaskDueDateLabel: event.dateTaskDueDateLabel,
        displayPriority: event.displayPriority ?? 0,
        isAutoScheduled: event.isAutoScheduled,
        scheduleId: event.scheduleId,
        scheduleStart: event.start,
        redacted: event.redacted,
        calendarColor: event.calendarColor,
        responseStatus: event.responseStatus,
        gcalEventType: event.gcalEventType,
        ...(gcalDetails == null ? {} : { gcalDetails }),
      },
    }
  })
}
