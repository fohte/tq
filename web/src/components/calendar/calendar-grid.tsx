import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { forwardRef } from 'react'

const EVENT_TYPE_CLASSES: Record<TimeBlockEvent['type'], string[]> = {
  manual: ['tq-event-manual'],
  auto: ['tq-event-auto'],
  gcal: ['tq-event-gcal'],
  completed: ['tq-event-completed'],
  schedule: ['tq-event-schedule'],
}

function getEventClassNames(type: TimeBlockEvent['type']): string[] {
  return EVENT_TYPE_CLASSES[type]
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
