import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { forwardRef } from 'react'

function getEventClassNames(type: TimeBlockEvent['type']): string[] {
  switch (type) {
    case 'manual':
      return ['tq-event-manual']
    case 'auto':
      return ['tq-event-auto']
    case 'gcal':
      return ['tq-event-gcal']
    case 'completed':
      return ['tq-event-completed']
    case 'schedule':
      return ['tq-event-schedule']
    default:
      return []
  }
}

interface CalendarGridProps {
  events: TimeBlockEvent[]
  onDatesSet?: (info: {
    start: Date
    end: Date
    view: { currentStart: Date }
  }) => void
}

export const CalendarGrid = forwardRef<FullCalendar, CalendarGridProps>(
  function CalendarGrid({ events, onDatesSet }, ref) {
    const calendarEvents = events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      classNames: getEventClassNames(event.type),
      extendedProps: { type: event.type },
    }))

    return (
      <div className="tq-calendar h-full">
        <FullCalendar
          ref={ref}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridDay"
          headerToolbar={false}
          events={calendarEvents}
          nowIndicator={true}
          allDaySlot={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          height="100%"
          expandRows={false}
          editable={true}
          selectable={true}
          dayHeaders={false}
          {...(onDatesSet ? { datesSet: onDatesSet } : {})}
        />
      </div>
    )
  },
)
