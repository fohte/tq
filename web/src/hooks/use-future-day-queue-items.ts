import { useMemo } from 'react'

import type { QueueItem } from '#hooks/use-queues'
import { formatLocalDate, getLocalWeekDateRange } from '#lib/date-range'

export function useFutureDayQueueItems({
  selectedDate,
  queueItems,
}: {
  selectedDate: Date
  queueItems: QueueItem[]
}) {
  const selectedDateStr = formatLocalDate(selectedDate)
  const { endDate } = getLocalWeekDateRange(selectedDate)

  return useMemo(
    () =>
      queueItems.flatMap((item) => {
        const date = item.periodStart
        return date != null && date > selectedDateStr && date <= endDate
          ? [{ date, item }]
          : []
      }),
    [endDate, queueItems, selectedDateStr],
  )
}
