import type FullCalendarType from '@fullcalendar/react'
import {
  type CalendarDndCallbacks,
  CalendarGrid,
} from '@web/components/calendar/calendar-grid'
import {
  CalendarHeader,
  type CalendarViewType,
  FULLCALENDAR_VIEW_MAP,
} from '@web/components/calendar/calendar-header'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface TimeBlockEvent {
  id: string
  title: string
  start: string
  end: string
  type: 'manual' | 'auto' | 'gcal' | 'completed' | 'schedule'
  /** Duration text (e.g. "1h", "30m") */
  duration?: string
  /** Parent task reference (e.g. "#488 tq 作成") */
  parentRef?: string
  /** Label (e.g. "dev:armyknife") */
  label?: string
  /** Custom color for schedule events */
  color?: {
    bg: string
    accent: string
  }
  /** Icon name for schedule events (lucide icon) */
  icon?: string
}

interface CalendarViewProps {
  events?: TimeBlockEvent[]
  dndCallbacks?: CalendarDndCallbacks | undefined
  externalDragContainerRef?: React.RefObject<HTMLElement | null> | undefined
  initialView?: CalendarViewType
}

export function CalendarView({
  events = [],
  dndCallbacks,
  externalDragContainerRef,
  initialView = 'day',
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendarType>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeView, setActiveView] = useState<CalendarViewType>(initialView)

  const handlePrev = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.prev()
      setCurrentDate(api.getDate())
    }
  }, [])

  const handleNext = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.next()
      setCurrentDate(api.getDate())
    }
  }, [])

  const handleToday = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.today()
      setCurrentDate(api.getDate())
    }
  }, [])

  const handleViewChange = useCallback((view: CalendarViewType) => {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.changeView(FULLCALENDAR_VIEW_MAP[view])
      setActiveView(view)
      setCurrentDate(api.getDate())
    }
  }, [])

  const handleDateClick = useCallback(
    (date: Date) => {
      // In month view, clicking a date navigates to day view for that date
      if (activeView === 'month') {
        const api = calendarRef.current?.getApi()
        if (api) {
          api.gotoDate(date)
          api.changeView('timeGridDay')
          setActiveView('day')
          setCurrentDate(date)
        }
      }
    },
    [activeView],
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
      setCurrentDate(info.view.currentStart)
    },
    [],
  )

  return (
    <div className="flex h-full flex-col">
      <CalendarHeader
        currentDate={currentDate}
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
        />
      </div>
    </div>
  )
}
