import type FullCalendarType from '@fullcalendar/react'
import { CalendarGrid } from '@web/components/calendar/calendar-grid'
import {
  CalendarHeader,
  type CalendarViewType,
} from '@web/components/calendar/calendar-header'
import { useCallback, useRef, useState } from 'react'

export interface TimeBlockEvent {
  id: string
  title: string
  start: string
  end: string
  type: 'manual' | 'auto' | 'gcal' | 'completed' | 'schedule'
}

interface CalendarViewProps {
  events?: TimeBlockEvent[]
}

export function CalendarView({ events = [] }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendarType>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeView, setActiveView] = useState<CalendarViewType>('day')

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
    setActiveView(view)
    // Week/Month views will be implemented in a future PR
  }, [])

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
          onDatesSet={handleDatesSet}
        />
      </div>
    </div>
  )
}
