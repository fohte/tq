import type { EventDropArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import type {
  EventReceiveArg,
  EventResizeDoneArg,
} from '@fullcalendar/interaction'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import {
  type CalendarViewType,
  FULLCALENDAR_VIEW_MAP,
} from '@web/components/calendar/calendar-header'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { EventBlock } from '@web/components/calendar/event-block'
import { getEventProps } from '@web/lib/calendar-utils'
import { forwardRef, useEffect } from 'react'

export interface CalendarDndCallbacks {
  onEventDrop?: (info: {
    eventId: string
    newStart: Date
    newEnd: Date
    revert: () => void
  }) => void
  onEventResize?: (info: {
    eventId: string
    newStart: Date
    newEnd: Date
    revert: () => void
  }) => void
  onExternalDrop?: (info: {
    taskId: string
    taskTitle: string
    start: Date
    end: Date
  }) => void
}

interface CalendarGridProps {
  events: TimeBlockEvent[]
  activeView: CalendarViewType
  onDatesSet?: (info: {
    start: Date
    end: Date
    view: { currentStart: Date }
  }) => void
  dndCallbacks?: CalendarDndCallbacks | undefined
  externalDragContainerRef?: React.RefObject<HTMLElement | null> | undefined
  onDateClick?: (date: Date) => void
}

export const CalendarGrid = forwardRef<FullCalendar, CalendarGridProps>(
  function CalendarGrid(
    {
      events,
      activeView,
      onDatesSet,
      dndCallbacks,
      externalDragContainerRef,
      onDateClick,
    },
    ref,
  ) {
    // Initialize external draggable for Today's Queue
    useEffect(() => {
      if (!externalDragContainerRef?.current) return

      const draggable = new Draggable(externalDragContainerRef.current, {
        itemSelector: '[data-task-id]',
        eventData: (el) => {
          const taskId = el.getAttribute('data-task-id') ?? ''
          const taskTitle = el.getAttribute('data-task-title') ?? ''
          const estimatedMinutes = el.getAttribute('data-estimated-minutes')
          const durationMinutes =
            estimatedMinutes != null && estimatedMinutes !== ''
              ? Number.parseInt(estimatedMinutes, 10)
              : 30

          return {
            id: `external-${taskId}`,
            title: taskTitle,
            duration: {
              minutes: durationMinutes,
            },
            extendedProps: {
              taskId,
              type: 'manual',
            },
          }
        },
      })

      return () => {
        draggable.destroy()
      }
    }, [externalDragContainerRef])

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
      },
    }))

    const handleEventDrop = (info: EventDropArg) => {
      if (!dndCallbacks?.onEventDrop) return
      const { event, revert } = info
      if (!event.start || !event.end) {
        revert()
        return
      }
      dndCallbacks.onEventDrop({
        eventId: event.id,
        newStart: event.start,
        newEnd: event.end,
        revert,
      })
    }

    const handleEventResize = (info: EventResizeDoneArg) => {
      if (!dndCallbacks?.onEventResize) return
      const { event, revert } = info
      if (!event.start || !event.end) {
        revert()
        return
      }
      dndCallbacks.onEventResize({
        eventId: event.id,
        newStart: event.start,
        newEnd: event.end,
        revert,
      })
    }

    const handleReceive = (info: EventReceiveArg) => {
      if (!dndCallbacks?.onExternalDrop) return
      const { event } = info
      const taskId = getEventProps(event).taskId
      if (!event.start || !event.end || taskId == null) {
        event.remove()
        return
      }
      // Remove the FullCalendar-created event; we'll let the optimistic update handle it
      event.remove()
      dndCallbacks.onExternalDrop({
        taskId,
        taskTitle: event.title,
        start: event.start,
        end: event.end,
      })
    }

    return (
      <div className="tq-calendar h-full">
        <FullCalendar
          ref={ref}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView={FULLCALENDAR_VIEW_MAP[activeView]}
          headerToolbar={false}
          events={calendarEvents}
          eventContent={(arg) => {
            // In month view, render compact event pill with title
            if (arg.view.type === 'dayGridMonth') {
              const type = getEventProps(arg.event).type
              return (
                <div className="tq-month-event" data-event-type={type}>
                  <span className="tq-month-event-title">
                    {arg.event.title}
                  </span>
                </div>
              )
            }
            // Override timeText for overnight events to show actual end time
            // FullCalendar clips end to midnight for display, so we use the
            // real event.end to show the correct cross-day time range
            const startDate = arg.event.start
            const endDate = arg.event.end
            if (
              startDate &&
              endDate &&
              endDate.getDate() !== startDate.getDate()
            ) {
              const fmt = (d: Date) =>
                `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
              const overrideTimeText = `${fmt(startDate)} - ${fmt(endDate)}`
              return <EventBlock {...arg} timeText={overrideTimeText} />
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
          expandRows={activeView === 'month'}
          dayMaxEvents={activeView === 'month' ? true : false}
          editable={activeView !== 'month'}
          selectable={activeView !== 'month'}
          droppable={activeView === 'day'}
          dayHeaders={activeView !== 'day'}
          {...(activeView === 'week'
            ? {
                dayHeaderFormat: {
                  weekday: 'short' as const,
                  day: 'numeric' as const,
                },
              }
            : {})}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventReceive={handleReceive}
          snapDuration="00:15:00"
          {...(onDateClick
            ? {
                dateClick: (info: { date: Date }) => {
                  onDateClick(info.date)
                },
              }
            : {})}
          {...(onDatesSet ? { datesSet: onDatesSet } : {})}
        />
      </div>
    )
  },
)
