import type FullCalendarType from '@fullcalendar/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type CalendarDndCallbacks,
  CalendarGrid,
} from '#components/calendar/calendar-grid'
import {
  CalendarHeader,
  type CalendarViewType,
  FULLCALENDAR_VIEW_MAP,
} from '#components/calendar/calendar-header'
import { formatLocalDate } from '#lib/date-range'

export interface TimeBlockEvent {
  id: string
  title: string
  start: string
  end: string
  type: 'manual' | 'auto' | 'gcal' | 'completed' | 'schedule'
  /** Parent task reference (e.g. "#488 tq 作成") */
  parentRef?: string
  /** Custom accent color for schedule events */
  color?: {
    accent: string
  }
  /** Underlying schedule id, present when type is 'schedule' */
  scheduleId?: string
  /** Google Calendar's color for the event's calendar, used as an accent on gcal events */
  calendarColor?: string | null
  /** When true, content is hidden and rendered as a generic "busy" block */
  redacted?: boolean
  /** When true, rendered in FullCalendar's all-day row instead of a time slot */
  allDay?: boolean
}

interface CalendarViewProps {
  events?: TimeBlockEvent[]
  dndCallbacks?: CalendarDndCallbacks | undefined
  externalDragContainerRef?: React.RefObject<HTMLElement | null> | undefined
  initialView?: CalendarViewType
  selectedDate: Date
  onDateChange: (date: Date) => void
  onScheduleClick?: ((scheduleId: string) => void) | undefined
}

export function CalendarView({
  events = [],
  dndCallbacks,
  externalDragContainerRef,
  initialView = 'day',
  selectedDate,
  onDateChange,
  onScheduleClick,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendarType>(null)
  const [activeView, setActiveView] = useState<CalendarViewType>(initialView)
  // Set while the sync effect below drives FullCalendar via gotoDate, so
  // handleDatesSet can ignore the datesSet it synchronously triggers.
  const isProgrammaticGotoRef = useRef(false)

  const handlePrev = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.prev()
      onDateChange(api.getDate())
    }
  }, [onDateChange])

  const handleNext = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.next()
      onDateChange(api.getDate())
    }
  }, [onDateChange])

  const handleToday = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.today()
      onDateChange(api.getDate())
    }
  }, [onDateChange])

  const handleViewChange = useCallback(
    (view: CalendarViewType) => {
      const api = calendarRef.current?.getApi()
      if (api) {
        api.changeView(FULLCALENDAR_VIEW_MAP[view])
        setActiveView(view)
        onDateChange(api.getDate())
      }
    },
    [onDateChange],
  )

  const handleDateClick = useCallback(
    (date: Date) => {
      // In month view, clicking a date navigates to day view for that date
      if (activeView === 'month') {
        const api = calendarRef.current?.getApi()
        if (api) {
          api.gotoDate(date)
          api.changeView('timeGridDay')
          setActiveView('day')
          onDateChange(date)
        }
      }
    },
    [activeView, onDateChange],
  )

  // Sync FullCalendar view when activeView changes from external source (e.g. initialView)
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      const currentFcView = api.view.type
      const expectedFcView = FULLCALENDAR_VIEW_MAP[activeView]
      if (currentFcView !== expectedFcView) {
        api.changeView(expectedFcView)
      }
    }
  }, [activeView])

  const handleDatesSet = useCallback(
    (info: { start: Date; end: Date; view: { currentStart: Date } }) => {
      if (isProgrammaticGotoRef.current) return
      onDateChange(info.view.currentStart)
    },
    [onDateChange],
  )

  // Sync FullCalendar's internal date when selectedDate changes from an
  // external source (e.g. the live-today rollover), so a subsequent
  // prev/next computes from the reported selectedDate, not a stale anchor.
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (
      api &&
      formatLocalDate(api.getDate()) !== formatLocalDate(selectedDate)
    ) {
      isProgrammaticGotoRef.current = true
      api.gotoDate(selectedDate)
      isProgrammaticGotoRef.current = false
    }
  }, [selectedDate])

  return (
    <div className="flex h-full flex-col">
      <CalendarHeader
        currentDate={selectedDate}
        activeView={activeView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
      />
      <div className="flex-1 overflow-auto">
        <CalendarGrid
          ref={calendarRef}
          events={events}
          activeView={activeView}
          onDatesSet={handleDatesSet}
          dndCallbacks={dndCallbacks}
          externalDragContainerRef={externalDragContainerRef}
          onDateClick={handleDateClick}
          onScheduleClick={onScheduleClick}
          initialDate={selectedDate}
        />
      </div>
    </div>
  )
}
