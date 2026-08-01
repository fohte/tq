import { useCallback, useState } from 'react'

import { useLiveToday } from '#hooks/use-live-today'
import { formatLocalDate } from '#lib/date-range'

/**
 * Tracks which date the calendar screen is showing. Defaults to (and
 * follows) today until the user navigates away, at which point the picked
 * date is pinned and no longer moves with the real-world date. Navigating
 * back to today's date un-pins it, so a later midnight rollover resumes
 * following the live date instead of staying frozen on the old "today".
 */
export function useSelectedDate() {
  const liveToday = useLiveToday()
  const [pinnedDate, setPinnedDate] = useState<Date | null>(null)
  const selectedDate = pinnedDate ?? liveToday

  const setSelectedDate = useCallback(
    (date: Date) => {
      setPinnedDate(
        formatLocalDate(date) === formatLocalDate(liveToday) ? null : date,
      )
    },
    [liveToday],
  )

  return { selectedDate, setSelectedDate }
}
