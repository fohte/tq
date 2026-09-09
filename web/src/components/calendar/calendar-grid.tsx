import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import type {
  EventReceiveArg,
  EventResizeDoneArg,
} from '@fullcalendar/interaction'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import {
  type CalendarViewType,
  FULLCALENDAR_THREE_DAY_VIEW,
  resolveFullCalendarView,
} from '#components/calendar/calendar-header'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { EventBlock, GcalStatusBand } from '#components/calendar/event-block'
import { useIsDesktop } from '#hooks/use-is-desktop'
import {
  getEventProps,
  isClickableEvent,
  isGcalEventType,
  isPendingGcalResponse,
} from '#lib/calendar-utils'

export interface CalendarDndCallbacks {
  onEventDrop?: (info: {
    eventId: string
    newStart: Date
    newEnd: Date
    oldStart: Date
    oldEnd: Date
    el: HTMLElement
    revert: () => void
  }) => void
  onEventResize?: (info: {
    eventId: string
    newStart: Date
    newEnd: Date
    oldStart: Date
    oldEnd: Date
    el: HTMLElement
    revert: () => void
  }) => void
  onExternalDrop?: (info: {
    taskId: string
    taskTitle: string
    start: Date
    end: Date
  }) => void
}

function formatHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  onScheduleClick?: ((scheduleId: string, start: string) => void) | undefined
  onTaskClick?: ((taskId: string) => void) | undefined
  onSelectRange?: ((info: { start: Date; end: Date }) => void) | undefined
  initialDate?: Date
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
      onScheduleClick,
      onTaskClick,
      onSelectRange,
      initialDate,
    },
    ref,
  ) {
    const isDesktop = useIsDesktop()
    const fullCalendarRef = useRef<FullCalendar>(null)
    useImperativeHandle<FullCalendar | null, FullCalendar | null>(
      ref,
      () => fullCalendarRef.current,
      [],
    )

    // `initialView` only applies on FullCalendar's first mount, so if
    // isDesktop's value flips afterward (e.g. the test runner resizes the
    // viewport post-mount, or an actual viewport/orientation change) the
    // rendered view would otherwise stay stuck on the stale one.
    useEffect(() => {
      const api = fullCalendarRef.current?.getApi()
      if (api) {
        const expectedView = resolveFullCalendarView(activeView, isDesktop)
        if (api.view.type !== expectedView) {
          api.changeView(expectedView)
        }
      }
    }, [activeView, isDesktop])

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
      allDay: event.allDay === true,
      editable:
        event.type !== 'schedule' &&
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
        scheduleId: event.scheduleId,
        scheduleStart: event.start,
        redacted: event.redacted,
        calendarColor: event.calendarColor,
        responseStatus: event.responseStatus,
        gcalEventType: event.gcalEventType,
      },
    }))

    const handleEventDrop = (info: EventDropArg) => {
      if (!dndCallbacks?.onEventDrop) return
      const { event, oldEvent, revert, el } = info
      if (
        !event.start ||
        !event.end ||
        event.allDay ||
        !oldEvent.start ||
        !oldEvent.end
      ) {
        revert()
        return
      }
      dndCallbacks.onEventDrop({
        eventId: event.id,
        newStart: event.start,
        newEnd: event.end,
        oldStart: oldEvent.start,
        oldEnd: oldEvent.end,
        el,
        revert,
      })
    }

    const handleEventResize = (info: EventResizeDoneArg) => {
      if (!dndCallbacks?.onEventResize) return
      const { event, oldEvent, revert, el } = info
      if (!event.start || !event.end || !oldEvent.start || !oldEvent.end) {
        revert()
        return
      }
      dndCallbacks.onEventResize({
        eventId: event.id,
        newStart: event.start,
        newEnd: event.end,
        oldStart: oldEvent.start,
        oldEnd: oldEvent.end,
        el,
        revert,
      })
    }

    const handleEventClick = (info: EventClickArg) => {
      const props = getEventProps(info.event)
      if (!isClickableEvent(props)) return
      const { type, scheduleId, scheduleStart, taskId } = props
      if (type === 'schedule') {
        if (scheduleId != null && scheduleStart != null) {
          onScheduleClick?.(scheduleId, scheduleStart)
        }
        return
      }
      if (taskId != null) {
        onTaskClick?.(taskId)
      }
    }

    const handleSelect = (info: DateSelectArg) => {
      if (!onSelectRange || info.allDay) return
      onSelectRange({ start: info.start, end: info.end })
    }

    const handleReceive = (info: EventReceiveArg) => {
      if (!dndCallbacks?.onExternalDrop) return
      const { event } = info
      const taskId = getEventProps(event).taskId
      if (!event.start || !event.end || taskId == null || event.allDay) {
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
          ref={fullCalendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView={resolveFullCalendarView(activeView, isDesktop)}
          views={{
            [FULLCALENDAR_THREE_DAY_VIEW]: {
              type: 'timeGrid',
              duration: { days: 3 },
            },
          }}
          {...(initialDate ? { initialDate } : {})}
          headerToolbar={false}
          eventClassNames={(arg) =>
            isClickableEvent(getEventProps(arg.event))
              ? ['tq-event-clickable']
              : []
          }
          events={calendarEvents}
          eventContent={(arg) => {
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
                    {eventProps.redacted === true
                      ? '予定あり'
                      : arg.event.title}
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
            if (
              !arg.event.allDay &&
              startDate &&
              endDate &&
              endDate.getDate() !== startDate.getDate()
            ) {
              const overrideTimeText = `${formatHm(startDate)}–${formatHm(endDate)}`
              return <EventBlock {...arg} timeText={overrideTimeText} />
            }
            return <EventBlock {...arg} />
          }}
          nowIndicator={true}
          nowIndicatorContent={(arg) => {
            // arg.date is the column's day-start marker, not the current
            // moment (FullCalendar forwards `cell.date`, not `nowDate`, to
            // this hook) — read the wall clock directly instead. FullCalendar
            // re-invokes this callback on its own per-minute timer, so no
            // extra live-clock state is needed to keep the label current.
            if (arg.isAxis) return undefined
            return (
              <span className="absolute -top-3.5 right-1 hidden font-mono text-2xs text-primary md:inline">
                {formatHm(new Date())}
              </span>
            )
          }}
          defaultRangeSeparator="–"
          allDaySlot={true}
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
          droppable={activeView !== 'month'}
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
          eventClick={handleEventClick}
          select={handleSelect}
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
