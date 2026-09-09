import type {
  DateSelectArg,
  DatesSetArg,
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
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import {
  type CalendarViewType,
  FULLCALENDAR_THREE_DAY_VIEW,
  resolveFullCalendarView,
} from '#components/calendar/calendar-header'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { EventBlock, GcalStatusBand } from '#components/calendar/event-block'
import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import { useIsDesktop } from '#hooks/use-is-desktop'
import {
  findHoveredSlot,
  getEventProps,
  isClickableEvent,
  isGcalEventType,
  isPendingGcalResponse,
  type SlotGhostRect,
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

const DEFAULT_SCROLL_TIME = '08:00:00'

function getScrollTime(rangeStart: Date, rangeEnd: Date): string {
  const now = new Date()
  if (now < rangeStart || now >= rangeEnd) return DEFAULT_SCROLL_TIME
  // Without the floor, a time shortly after midnight would produce a
  // negative-minutes string that FullCalendar's scrollToTime silently drops.
  const minutes = Math.max(0, now.getHours() * 60 + now.getMinutes() - 60)
  const shifted = new Date(now)
  shifted.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return `${formatHm(shifted)}:00`
}

function getDayRange(date: Date): [Date, Date] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [start, end]
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
    const [slotGhost, setSlotGhost] = useState<SlotGhostRect | null>(null)
    useImperativeHandle<FullCalendar | null, FullCalendar | null>(
      ref,
      () => fullCalendarRef.current,
      [],
    )

    // `scrollTime` is a real FullCalendar option, but — like `initialView`
    // below — it only takes effect on first mount. handleDatesSet's
    // imperative scrollToTime call covers every later navigation instead.
    const [initialScrollTime] = useState(() =>
      getScrollTime(...getDayRange(initialDate ?? new Date())),
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
        isAutoScheduled: event.isAutoScheduled,
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

    const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('.fc-event')) {
        setSlotGhost(null)
        return
      }
      const next = findHoveredSlot(e.currentTarget, e.clientX, e.clientY)
      // Skip the update when nothing moved, so FullCalendar doesn't rebuild
      // its event store on every mousemove within the same slot.
      setSlotGhost((prev) =>
        prev &&
        next &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      )
    }

    const handleGridMouseLeave = () => {
      setSlotGhost(null)
    }

    const handleSelect = (info: DateSelectArg) => {
      if (!onSelectRange || info.allDay) return
      onSelectRange({ start: info.start, end: info.end })
    }

    const handleDatesSet = (info: DatesSetArg) => {
      onDatesSet?.(info)
      // Covers navigation; initialScrollTime above covers first mount.
      fullCalendarRef.current
        ?.getApi()
        .scrollToTime(getScrollTime(info.start, info.end))
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
      <div
        className="tq-calendar relative h-full"
        onMouseMove={handleGridMouseMove}
        onMouseLeave={handleGridMouseLeave}
        // Scrolling `.fc-scroller` without moving the pointer would
        // otherwise leave the ghost stale; capture since scroll doesn't bubble.
        onScrollCapture={handleGridMouseLeave}
      >
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
          scrollTime={initialScrollTime}
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
          datesSet={handleDatesSet}
        />
        {slotGhost && (
          <div
            className="fc-highlight tq-slot-hover-ghost"
            style={{
              top: slotGhost.top,
              left: slotGhost.left,
              width: slotGhost.width,
              height: slotGhost.height,
            }}
          />
        )}
      </div>
    )
  },
)
