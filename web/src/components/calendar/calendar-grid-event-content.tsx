import type { EventContentArg } from '@fullcalendar/core'

import { EventBlock, GcalStatusBand } from '#components/calendar/event-block'
import {
  getTaskDateEventProps,
  TaskDateEvent,
} from '#components/calendar/task-date-event'
import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import { formatHm } from '#lib/calendar-grid-time'
import { getEventProps, isPendingGcalResponse } from '#lib/calendar-utils'

interface MonthEventStyle extends React.CSSProperties {
  '--event-accent'?: string
}

export function renderCalendarGridEventContent(
  arg: EventContentArg,
): React.ReactNode {
  // In month view, render compact event pill with title
  if (arg.view.type === 'dayGridMonth') {
    const eventProps = getEventProps(arg.event)
    if (eventProps.type === 'task-date') {
      return (
        <TaskDateEvent
          title={arg.event.title}
          {...getTaskDateEventProps(eventProps)}
          isStart={arg.isStart}
          isEnd={arg.isEnd}
          variant="month"
        />
      )
    }
    const monthAccent =
      eventProps.type === 'schedule'
        ? eventProps.color?.accent
        : eventProps.type === 'gcal-meeting' ||
            eventProps.type === 'gcal-info' ||
            eventProps.type === 'gcal-solo'
          ? eventProps.calendarColor
          : undefined
    const monthEventStyle: MonthEventStyle | undefined =
      monthAccent == null || eventProps.redacted === true
        ? undefined
        : { '--event-accent': monthAccent }

    return (
      <div
        className="tq-month-event"
        style={monthEventStyle}
        data-event-type={eventProps.type}
        data-redacted={eventProps.redacted === true}
        data-pending-response={isPendingGcalResponse(eventProps)}
        data-continues-before={arg.event.allDay && !arg.isStart}
        data-continues-after={arg.event.allDay && !arg.isEnd}
      >
        <span className="tq-month-event-title">
          {eventProps.redacted === true ? '予定あり' : arg.event.title}
        </span>
      </div>
    )
  }
  if (arg.event.display === 'background') {
    return <GcalStatusBand {...arg} />
  }
  // Override timeText for overnight events to show actual end time
  // FullCalendar clips end to midnight for display, so we use the
  // real event.end to show the correct cross-day time range
  const startDate = arg.event.start
  const endDate = arg.event.end
  const content =
    !arg.event.allDay &&
    startDate &&
    endDate &&
    endDate.getDate() !== startDate.getDate() ? (
      <EventBlock
        {...arg}
        timeText={`${formatHm(startDate)}–${formatHm(endDate)}`}
      />
    ) : (
      <EventBlock {...arg} />
    )
  return (
    <TimeBlockPreviewTrigger event={arg.event}>
      {content}
    </TimeBlockPreviewTrigger>
  )
}
