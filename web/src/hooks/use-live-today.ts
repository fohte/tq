import { useEffect, useState } from 'react'

import { formatLocalDate } from '#lib/date-range'

export const LIVE_TODAY_CHECK_INTERVAL_MS = 60_000

/**
 * Returns the current local date, re-rendering once the local calendar day
 * actually changes. A plain `new Date()` computed once on mount would stay
 * stuck on the mount day forever if the tab is left open across midnight.
 */
export function useLiveToday(): Date {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => {
      setToday((prev) => {
        const now = new Date()
        return formatLocalDate(now) === formatLocalDate(prev) ? prev : now
      })
    }, LIVE_TODAY_CHECK_INTERVAL_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  return today
}
