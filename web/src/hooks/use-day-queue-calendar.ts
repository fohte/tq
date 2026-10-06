import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import type { Queue, QueueItem } from '#hooks/use-queues'
import {
  DAY_QUEUE_KEY,
  fetchQueueItems,
  queueKeys,
  useQueueItemsForDates,
  useSetQueueItems,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import type { useCreateTimeBlock } from '#hooks/use-time-blocks'
import { formatLocalDate, getLocalDateRangeDays } from '#lib/date-range'
import { appendQueueTaskId } from '#lib/queue-task-order'

interface UseDayQueueCalendarOptions {
  queues: Queue[] | undefined
  startDate: string
  endDate: string
  refetchInterval?: number
  createTimeBlock: ReturnType<typeof useCreateTimeBlock>
  setQueueItems: ReturnType<typeof useSetQueueItems>
  onTimeBlockChange: NonNullable<CalendarDndCallbacks['onEventResize']>
}

export function useDayQueueCalendar({
  queues,
  startDate,
  endDate,
  refetchInterval,
  createTimeBlock,
  setQueueItems,
  onTimeBlockChange,
}: UseDayQueueCalendarOptions) {
  const queryClient = useQueryClient()
  const visibleDates = useMemo(
    () => getLocalDateRangeDays(startDate, endDate),
    [startDate, endDate],
  )
  const dayQueueItemsResults = useQueueItemsForDates(
    queues != null && queues.some((queue) => queue.key === DAY_QUEUE_KEY)
      ? DAY_QUEUE_KEY
      : undefined,
    visibleDates,
    refetchInterval,
  )
  const loggedQueryErrors = useRef(new Map<string, number>())
  useEffect(() => {
    const visibleDateSet = new Set(visibleDates)
    for (const date of loggedQueryErrors.current.keys()) {
      if (!visibleDateSet.has(date)) loggedQueryErrors.current.delete(date)
    }
    dayQueueItemsResults.forEach((result, index) => {
      const date = visibleDates[index]
      if (date == null || result.error == null) return
      if (loggedQueryErrors.current.get(date) === result.errorUpdatedAt) return
      loggedQueryErrors.current.set(date, result.errorUpdatedAt)
      console.error('Failed to refresh calendar day queue items', {
        date,
        error: result.error,
      })
    })
  }, [dayQueueItemsResults, visibleDates])
  const dayQueueItems = useMemo(
    () =>
      visibleDates.flatMap((date, index) =>
        (dayQueueItemsResults[index]?.data ?? []).map(
          (item, queuePosition) => ({ date, item, queuePosition }),
        ),
      ),
    [visibleDates, dayQueueItemsResults],
  )

  const getQueueItems = useCallback(
    (key: string, date: string) => {
      const queryKey = queueKeys.items(key, date)
      const cachedItems = queryClient.getQueryData<QueueItem[]>(queryKey)
      return cachedItems == null
        ? queryClient.fetchQuery({
            queryKey,
            queryFn: () => fetchQueueItems(key, date),
          })
        : Promise.resolve(cachedItems)
    },
    [queryClient],
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

  return { dayQueueItems, dndCallbacks }
}
