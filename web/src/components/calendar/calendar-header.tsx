import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '#components/ui/button'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { TabStrip } from '#components/ui/tab-strip'
import { formatLocalDate } from '#lib/date-range'

export type CalendarViewType = 'day' | 'week' | 'month'

export const FULLCALENDAR_VIEW_MAP: Record<CalendarViewType, string> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
}

/** Custom FullCalendar view name for the narrow-viewport week view (see resolveFullCalendarView). */
export const FULLCALENDAR_THREE_DAY_VIEW = 'timeGridThreeDay'

/**
 * On narrow viewports, 7 day columns leave too little width for event chips
 * (title gets squeezed to 0px by the fixed-width type badge). Desktop
 * calendar apps solve this by dropping down to a single view, not scrolling
 * horizontally; here we substitute a 3-day view for week, matching the
 * pattern Fantastical's "Days in Week View" setting exposes.
 */
export function resolveFullCalendarView(
  view: CalendarViewType,
  isDesktop: boolean,
): string {
  if (view === 'week' && !isDesktop) return FULLCALENDAR_THREE_DAY_VIEW
  return FULLCALENDAR_VIEW_MAP[view]
}

const VIEW_OPTIONS: { value: CalendarViewType; label: string }[] = [
  { value: 'day', label: 'day' },
  { value: 'week', label: 'week' },
  { value: 'month', label: 'month' },
]

interface CalendarHeaderProps {
  currentDate: Date
  activeView: CalendarViewType
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (view: CalendarViewType) => void
}

function formatWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

export function CalendarHeader({
  currentDate,
  activeView,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: CalendarHeaderProps) {
  return (
    <ScreenHeaderBar>
      <span className="font-mono text-sm font-bold">
        {formatLocalDate(currentDate)}
      </span>
      <span className="font-mono text-2xs text-muted-foreground">
        {formatWeekday(currentDate)}
      </span>

      <div className="ml-2 flex">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={onPrev}
          aria-label="Previous"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={onToday}
          className="border-x-0"
        >
          today
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={onNext}
          aria-label="Next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <TabStrip
        className="ml-auto"
        value={activeView}
        options={VIEW_OPTIONS}
        onChange={onViewChange}
      />
    </ScreenHeaderBar>
  )
}
