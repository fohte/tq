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

import type { CalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail'
import { renderCalendarGridEventContent } from '#components/calendar/calendar-grid-event-content'
import {
  getCalendarGridEventClassNames,
  mapCalendarGridEvents,
} from '#components/calendar/calendar-grid-event-data'
import {
  type CalendarViewType,
  FULLCALENDAR_THREE_DAY_VIEW,
  resolveFullCalendarView,
} from '#components/calendar/calendar-header'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { GcalEventDetailPopover } from '#components/calendar/gcal-event-detail-popover'
import { useIsDesktop } from '#hooks/use-is-desktop'
import { formatHm, getDayRange, getScrollTime } from '#lib/calendar-grid-time'
import {
  findHoveredSlot,
  getEventProps,
  getGcalEventDetails,
  isClickableEvent,
  isGcalEventType,
  type SlotGhostRect,
} from '#lib/calendar-utils'

export interface CalendarDndCallbacks {
  onEventDrop?: (info: {
    eventId: string
    eventType: string | undefined
    taskId: string | undefined
    isAllDay: boolean
    wasAllDay: boolean
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
    allDay: boolean
    sourceQueueKey: string | undefined
    sourceDate: string | undefined
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
  onScheduleClick?: ((scheduleId: string, start: string) => void) | undefined
  onTaskClick?: ((taskId: string) => void) | undefined
  onSelectRange?: ((info: { start: Date; end: Date }) => void) | undefined
  initialDate?: Date
  initialScrollTime?: string | undefined
}

type SlotGhostStyle = React.CSSProperties & Record<`--slot-${string}`, string>

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
      initialScrollTime,
    },
    ref,
  ) {
    const isDesktop = useIsDesktop()
    const fullCalendarRef = useRef<FullCalendar>(null)
    // FullCalendar fires its first datesSet synchronously while mounting,
    // before this component's own mount effect below can run — so this flag
    // is still false for that call and only flips true for later navigation.
    const hasMountedRef = useRef(false)
    const [slotGhost, setSlotGhost] = useState<SlotGhostRect | null>(null)
    const [selectedGcalEvent, setSelectedGcalEvent] =
      useState<CalendarGcalEventDetails | null>(null)
    const [gcalEventAnchorRect, setGcalEventAnchorRect] =
      useState<DOMRect | null>(null)
    const gcalEventAnchorRef = useRef<HTMLDivElement | null>(null)
    useImperativeHandle<FullCalendar | null, FullCalendar | null>(
      ref,
      () => fullCalendarRef.current,
      [],
    )

    // `scrollTime` is a real FullCalendar option, but — like `initialView`
    // below — it only takes effect on first mount. handleDatesSet's
    // imperative scrollToTime call covers every later navigation instead.
    const [scrollTime] = useState(
      () =>
        initialScrollTime ??
        getScrollTime(...getDayRange(initialDate ?? new Date())),
    )

    useEffect(() => {
      hasMountedRef.current = true
    }, [])

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
          const queueSource = el.closest<HTMLElement>('[data-queue-key]')
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
              sourceQueueKey:
                queueSource?.getAttribute('data-queue-key') ?? undefined,
              sourceDate:
                queueSource?.getAttribute('data-queue-date') ?? undefined,
            },
          }
        },
      })

      return () => {
        draggable.destroy()
      }
    }, [externalDragContainerRef])

    const calendarEvents = mapCalendarGridEvents(events, activeView)

    const handleEventDrop = (info: EventDropArg) => {
      if (!dndCallbacks?.onEventDrop) return
      const { event, oldEvent, revert, el } = info
      const eventType = getEventProps(event).type
      const oldEventType = getEventProps(oldEvent).type
      const isDayQueueEvent =
        eventType === 'day-queue' && oldEventType === 'day-queue'
      if (
        !event.start ||
        !event.end ||
        !oldEvent.start ||
        !oldEvent.end ||
        ((event.allDay || oldEvent.allDay) && !isDayQueueEvent)
      ) {
        revert()
        return
      }
      dndCallbacks.onEventDrop({
        eventId: event.id,
        eventType,
        taskId: getEventProps(event).taskId,
        isAllDay: event.allDay,
        wasAllDay: oldEvent.allDay,
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
      if (
        event.allDay ||
        getEventProps(event).type === 'day-queue' ||
        getEventProps(oldEvent).type === 'day-queue'
      ) {
        revert()
        return
      }
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
      if (isGcalEventType(props.type)) {
        const gcalDetails = getGcalEventDetails(props)
        if (gcalDetails != null) {
          setGcalEventAnchorRect(info.el.getBoundingClientRect())
          setSelectedGcalEvent(gcalDetails)
        }
        return
      }
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
      // FullCalendar fires datesSet synchronously on its own initial mount
      // too, before hasMountedRef flips true — skip that call so it can't
      // recompute and overwrite the `scrollTime` option (seeded from
      // initialScrollTime above) before it's ever visible.
      if (!hasMountedRef.current) return
      fullCalendarRef.current
        ?.getApi()
        .scrollToTime(getScrollTime(info.start, info.end))
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
        allDay: event.allDay,
        sourceQueueKey: getEventProps(event).sourceQueueKey,
        sourceDate: getEventProps(event).sourceDate,
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
          eventClassNames={getCalendarGridEventClassNames}
          events={calendarEvents}
          eventContent={renderCalendarGridEventContent}
          eventOrder="-displayPriority,queueOrder,queuePosition,start,-duration,allDay,title"
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
          scrollTime={scrollTime}
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
            className="fc-highlight tq-slot-hover-ghost top-(--slot-top)! left-(--slot-left)! w-(--slot-width)! h-(--slot-height)!"
            style={
              {
                '--slot-top': `${String(slotGhost.top)}px`,
                '--slot-left': `${String(slotGhost.left)}px`,
                '--slot-width': `${String(slotGhost.width)}px`,
                '--slot-height': `${String(slotGhost.height)}px`,
              } as SlotGhostStyle
            }
          />
        )}
        {selectedGcalEvent != null && gcalEventAnchorRect != null && (
          <>
            <div
              ref={gcalEventAnchorRef}
              aria-hidden="true"
              data-gcal-event-popover-anchor
              style={{
                position: 'fixed',
                left: gcalEventAnchorRect.left,
                top: gcalEventAnchorRect.top,
                width: gcalEventAnchorRect.width,
                height: gcalEventAnchorRect.height,
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
            <GcalEventDetailPopover
              anchor={gcalEventAnchorRef}
              event={selectedGcalEvent}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedGcalEvent(null)
                  setGcalEventAnchorRect(null)
                }
              }}
            />
          </>
        )}
      </div>
    )
  },
)
