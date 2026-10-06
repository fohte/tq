import { useMemo } from 'react'

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
  refetchInterval,
}: {
  selectedDate: Date
  hasDayQueue: boolean
  refetchInterval?: number
}) {
  const selectedDateStr = formatLocalDate(selectedDate)
  const futureDayQueueDates = useMemo(() => {
    const { endDate } = getLocalWeekDateRange(selectedDate)
    return getLocalDateRangeDays(addLocalDays(selectedDateStr, 1), endDate)
  }, [selectedDate, selectedDateStr])
  const futureDayQueueItemsResults = useQueueItemsForDates(
    hasDayQueue ? DAY_QUEUE_KEY : undefined,
    futureDayQueueDates,
    refetchInterval,
  )

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
