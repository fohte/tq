import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import type { Queue, QueueItem } from '#hooks/use-queues'
import {
  DAY_QUEUE_KEY,
  fetchQueueItems,
  queueKeys,
  useQueueItemsForRange,
  useSetQueueItems,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import type { useCreateTimeBlock } from '#hooks/use-time-blocks'
import {
  formatLocalDate,
  getLocalDateRangeDays,
  getLocalWeekDateRange,
} from '#lib/date-range'
import { appendQueueTaskId } from '#lib/queue-task-order'

interface UseDayQueueCalendarOptions {
  queues: Queue[] | undefined
  selectedDate: Date
  startDate: string
  endDate: string
  createTimeBlock: ReturnType<typeof useCreateTimeBlock>
  setQueueItems: ReturnType<typeof useSetQueueItems>
  onTimeBlockChange: NonNullable<CalendarDndCallbacks['onEventResize']>
}

export function useDayQueueCalendar({
  queues,
  selectedDate,
  startDate,
  endDate,
  createTimeBlock,
  setQueueItems,
  onTimeBlockChange,
}: UseDayQueueCalendarOptions) {
  const queryClient = useQueryClient()
  const visibleDates = useMemo(
    () => getLocalDateRangeDays(startDate, endDate),
    [startDate, endDate],
  )
  const queueRange = useMemo(() => {
    const weekRange = getLocalWeekDateRange(selectedDate)
    return {
      from: weekRange.startDate < startDate ? weekRange.startDate : startDate,
      to: weekRange.endDate > endDate ? weekRange.endDate : endDate,
    }
  }, [endDate, selectedDate, startDate])
  const dayQueueItemsQuery = useQueueItemsForRange(
    DAY_QUEUE_KEY,
    queueRange.from,
    queueRange.to,
    {
      enabled: queues?.some((queue) => queue.key === DAY_QUEUE_KEY) === true,
    },
  )
  const loggedQueryError = useRef<{
    from: string
    to: string
    errorUpdatedAt: number
  } | null>(null)
  useEffect(() => {
    if (dayQueueItemsQuery.error == null) return
    const previous = loggedQueryError.current
    if (
      previous?.from === queueRange.from &&
      previous.to === queueRange.to &&
      previous.errorUpdatedAt === dayQueueItemsQuery.errorUpdatedAt
    ) {
      return
    }
    loggedQueryError.current = {
      from: queueRange.from,
      to: queueRange.to,
      errorUpdatedAt: dayQueueItemsQuery.errorUpdatedAt,
    }
    console.error('Failed to refresh calendar day queue items', {
      from: queueRange.from,
      to: queueRange.to,
      error: dayQueueItemsQuery.error,
    })
  }, [dayQueueItemsQuery.error, dayQueueItemsQuery.errorUpdatedAt, queueRange])
  const dayQueueItems = useMemo(() => {
    const visibleDateSet = new Set(visibleDates)
    const itemsByDate = new Map<string, QueueItem[]>()
    for (const item of dayQueueItemsQuery.data ?? []) {
      const date = item.periodStart
      if (date == null || !visibleDateSet.has(date)) continue
      const items = itemsByDate.get(date) ?? []
      items.push(item)
      itemsByDate.set(date, items)
    }
    return visibleDates.flatMap((date) =>
      (itemsByDate.get(date) ?? []).map((item, queuePosition) => ({
        date,
        item,
        queuePosition,
      })),
    )
  }, [dayQueueItemsQuery.data, visibleDates])

  const getQueueItems = useCallback(
    (key: string, date: string) => {
      const queryKey = queueKeys.items(key, date)
      const cachedItems = queryClient.getQueryData<QueueItem[]>(queryKey)
      if (cachedItems != null) return Promise.resolve(cachedItems)

      if (
        key === DAY_QUEUE_KEY &&
        date >= queueRange.from &&
        date <= queueRange.to
      ) {
        const cachedRangeItems = queryClient.getQueryData<QueueItem[]>(
          queueKeys.itemsRange(key, queueRange.from, queueRange.to),
        )
        if (cachedRangeItems != null) {
          return Promise.resolve(
            cachedRangeItems.filter((item) => item.periodStart === date),
          )
        }
      }

      return queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchQueueItems(key, date),
      })
    },
    [queryClient, queueRange.from, queueRange.to],
  )

  const invalidateWeekQueueItems = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [...queueKeys.all, WEEK_QUEUE_KEY, 'items'],
    })
  }, [queryClient])

  const dayQueueUpdateInProgress = useRef(false)
  const updateDayQueue = useCallback(
    ({
      date,
      taskId,
      sourceQueueKey,
      sourceDate,
      revert,
    }: {
      date: string
      taskId: string
      sourceQueueKey?: string
      sourceDate?: string
      revert?: () => void
    }) => {
      if (dayQueueUpdateInProgress.current || setQueueItems.isPending) {
        revert?.()
        return
      }
      dayQueueUpdateInProgress.current = true

      const sourceItemsPromise =
        sourceQueueKey != null &&
        sourceDate != null &&
        !(sourceQueueKey === DAY_QUEUE_KEY && sourceDate === date)
          ? getQueueItems(sourceQueueKey, sourceDate)
          : Promise.resolve(undefined)

      void Promise.all([getQueueItems(DAY_QUEUE_KEY, date), sourceItemsPromise])
        .then(async ([destinationItems, sourceItems]) => {
          if (
            sourceItems != null &&
            sourceQueueKey != null &&
            sourceDate != null
          ) {
            await setQueueItems.mutateAsync({
              key: sourceQueueKey,
              date: sourceDate,
              taskIds: sourceItems
                .map((item) => item.taskId)
                .filter((id) => id !== taskId),
            })
          }

          const destinationResult = await setQueueItems
            .mutateAsync({
              key: DAY_QUEUE_KEY,
              date,
              taskIds: appendQueueTaskId(
                destinationItems.map((item) => item.taskId),
                taskId,
              ),
            })
            .then(
              () => ({ ok: true as const }),
              (error: unknown) => ({ ok: false as const, error }),
            )
          if (destinationResult.ok) return

          if (
            sourceItems != null &&
            sourceQueueKey != null &&
            sourceDate != null
          ) {
            await setQueueItems
              .mutateAsync({
                key: sourceQueueKey,
                date: sourceDate,
                taskIds: sourceItems.map((item) => item.taskId),
              })
              .then(
                () => {},
                (rollbackError: unknown) => {
                  console.error(
                    'Failed to restore source queue after calendar update',
                    rollbackError,
                  )
                },
              )
          }
          revert?.()
          console.error(
            'Failed to update day queue from calendar',
            destinationResult.error,
          )
        })
        .catch((error: unknown) => {
          revert?.()
          console.error('Failed to update day queue from calendar', error)
        })
        .finally(() => {
          invalidateWeekQueueItems()
          dayQueueUpdateInProgress.current = false
        })
    },
    [getQueueItems, invalidateWeekQueueItems, setQueueItems],
  )

  const dndCallbacks: CalendarDndCallbacks = useMemo(
    () => ({
      onEventDrop: (info) => {
        if (
          info.eventType === 'day-queue' &&
          info.taskId != null &&
          info.wasAllDay
        ) {
          if (info.isAllDay) {
            const sourceDate = formatLocalDate(info.oldStart)
            const targetDate = formatLocalDate(info.newStart)
            if (sourceDate === targetDate) return
            updateDayQueue({
              taskId: info.taskId,
              sourceQueueKey: DAY_QUEUE_KEY,
              sourceDate,
              date: targetDate,
              revert: info.revert,
            })
          } else {
            createTimeBlock.mutate({
              taskId: info.taskId,
              startTime: info.newStart.toISOString(),
              endTime: info.newEnd.toISOString(),
            })
          }
          return
        }
        onTimeBlockChange(info)
      },
      onEventResize: onTimeBlockChange,
      onExternalDrop: ({
        taskId,
        start,
        end,
        allDay,
        sourceQueueKey,
        sourceDate,
      }) => {
        if (allDay) {
          updateDayQueue({
            date: formatLocalDate(start),
            taskId,
            ...(sourceQueueKey == null ? {} : { sourceQueueKey }),
            ...(sourceDate == null ? {} : { sourceDate }),
          })
          return
        }
        createTimeBlock.mutate({
          taskId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        })
      },
    }),
    [createTimeBlock, onTimeBlockChange, updateDayQueue],
  )

  return {
    dayQueueItems,
    dayQueueItemsInRange: dayQueueItemsQuery.data ?? [],
    dndCallbacks,
  }
}
