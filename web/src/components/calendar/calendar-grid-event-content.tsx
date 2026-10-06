import type { EventContentArg } from '@fullcalendar/core'

import { EventBlock, GcalStatusBand } from '#components/calendar/event-block'
import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import { formatHm } from '#lib/calendar-grid-time'
import { getEventProps, isPendingGcalResponse } from '#lib/calendar-utils'

export function renderCalendarGridEventContent(
  arg: EventContentArg,
): React.ReactNode {
  // In month view, render compact event pill with title
  if (arg.view.type === 'dayGridMonth') {
    const eventProps = getEventProps(arg.event)
    return (
      <div
        className="tq-month-event"
        data-event-type={eventProps.type}
        data-pending-response={isPendingGcalResponse(eventProps)}
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
