import type { CalendarViewType } from '#components/calendar/calendar-header'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import {
  type CalendarEventProps,
  getGcalEventDetails,
  isClickableEvent,
  isGcalEventType,
} from '#lib/calendar-utils'

export function isCalendarEventClickable(props: CalendarEventProps): boolean {
  return isClickableEvent(props) || getGcalEventDetails(props) != null
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
      queueOrder: event.type === 'day-queue' ? 0 : 1,
      queuePosition: event.queuePosition,
      editable:
        event.type !== 'schedule' &&
        !isGcalEventType(event.type) &&
        event.redacted !== true,
      durationEditable: event.type !== 'day-queue',
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
        isAutoScheduled: event.isAutoScheduled,
        scheduleId: event.scheduleId,
        scheduleStart: event.start,
        queuePosition: event.queuePosition,
        redacted: event.redacted,
        calendarColor: event.calendarColor,
        responseStatus: event.responseStatus,
        gcalEventType: event.gcalEventType,
        ...(gcalDetails == null ? {} : { gcalDetails }),
      },
    }
  })
}
