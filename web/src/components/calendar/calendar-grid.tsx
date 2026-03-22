import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import {
  type CalendarViewType,
  FULLCALENDAR_VIEW_MAP,
} from '@web/components/calendar/calendar-header'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { EventBlock } from '@web/components/calendar/event-block'
import { forwardRef } from 'react'

interface CalendarGridProps {
  events: TimeBlockEvent[]
  activeView: CalendarViewType
  onDatesSet?: (info: {
    start: Date
    end: Date
    view: { currentStart: Date }
  }) => void
  onDateClick?: (date: Date) => void
}

export const CalendarGrid = forwardRef<FullCalendar, CalendarGridProps>(
  function CalendarGrid({ events, activeView, onDatesSet, onDateClick }, ref) {
    const calendarEvents = events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      extendedProps: {
        type: event.type,
        duration: event.duration,
        parentRef: event.parentRef,
        label: event.label,
        color: event.color,
        icon: event.icon,
        // Store original end time for overnight display
        originalEnd: event.end,
      },
    }))

    const isMonthView = activeView === 'month'

    return (
      <div className="tq-calendar h-full">
        <FullCalendar
          ref={ref}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView={FULLCALENDAR_VIEW_MAP[activeView]}
          headerToolbar={false}
          events={calendarEvents}
          eventContent={(arg) => {
            // In month view, render dot indicators instead of full event blocks
            if (isMonthView) {
              return null
            }
            // Override timeText for overnight events to show actual end time
            const originalEnd = arg.event.extendedProps['originalEnd'] as string
            if (originalEnd) {
              const startDate = arg.event.start
              const endDate = new Date(originalEnd)
              if (startDate && endDate.getDate() !== startDate.getDate()) {
                const fmt = (d: Date) =>
                  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                const overrideTimeText = `${fmt(startDate)} - ${fmt(endDate)}`
                return <EventBlock {...arg} timeText={overrideTimeText} />
              }
            }
            return <EventBlock {...arg} />
          }}
          nowIndicator={true}
          allDaySlot={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          height="100%"
          expandRows={false}
          editable={!isMonthView}
          selectable={!isMonthView}
          dayHeaders={activeView !== 'day'}
          {...(activeView === 'week'
            ? {
                dayHeaderFormat: {
                  weekday: 'short' as const,
                  day: 'numeric' as const,
                },
              }
            : {})}
          {...(onDateClick
            ? { dateClick: (info: { date: Date }) => onDateClick(info.date) }
            : {})}
          {...(onDatesSet ? { datesSet: onDatesSet } : {})}
        />
      </div>
    )
  },
)
