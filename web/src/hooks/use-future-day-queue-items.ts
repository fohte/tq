import { useEffect, useMemo, useRef } from 'react'

import { DAY_QUEUE_KEY, useQueueItemsForDates } from '#hooks/use-queues'
import {
  addLocalDays,
  formatLocalDate,
  getLocalDateRangeDays,
  getLocalWeekDateRange,
} from '#lib/date-range'

export function useFutureDayQueueItems({
  selectedDate,
  hasDayQueue,
}: {
  selectedDate: Date
  hasDayQueue: boolean
}) {
  const selectedDateStr = formatLocalDate(selectedDate)
  const futureDayQueueDates = useMemo(() => {
    const { endDate } = getLocalWeekDateRange(selectedDate)
    return getLocalDateRangeDays(addLocalDays(selectedDateStr, 1), endDate)
  }, [selectedDate, selectedDateStr])
  const futureDayQueueItemsResults = useQueueItemsForDates(
    hasDayQueue ? DAY_QUEUE_KEY : undefined,
    futureDayQueueDates,
  )
  const loggedQueryErrors = useRef(new Map<string, number>())
  useEffect(() => {
    const futureDateSet = new Set(futureDayQueueDates)
    for (const date of loggedQueryErrors.current.keys()) {
      if (!futureDateSet.has(date)) loggedQueryErrors.current.delete(date)
    }
    futureDayQueueItemsResults.forEach((result, index) => {
      const date = futureDayQueueDates[index]
      if (date == null || result.error == null) return
      if (loggedQueryErrors.current.get(date) === result.errorUpdatedAt) return
      loggedQueryErrors.current.set(date, result.errorUpdatedAt)
      console.error('Failed to refresh future day queue items', {
        date,
        error: result.error,
      })
    })
  }, [futureDayQueueItemsResults, futureDayQueueDates])

  return useMemo(
    () =>
      futureDayQueueDates.flatMap((date, index) =>
        (futureDayQueueItemsResults[index]?.data ?? []).map((item) => ({
          date,
          item,
        })),
      ),
    [futureDayQueueDates, futureDayQueueItemsResults],
  )
}
