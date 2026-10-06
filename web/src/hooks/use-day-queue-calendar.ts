import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

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

  const addTaskToDayQueue = useCallback(
    (
      date: string,
      taskId: string,
      sourceQueueKey: string | undefined,
      sourceDate: string | undefined,
    ) => {
      const sourceItemsPromise =
        sourceQueueKey != null &&
        sourceDate != null &&
        !(sourceQueueKey === DAY_QUEUE_KEY && sourceDate === date)
          ? getQueueItems(sourceQueueKey, sourceDate)
          : Promise.resolve(undefined)

      void Promise.all([getQueueItems(DAY_QUEUE_KEY, date), sourceItemsPromise])
        .then(([destinationItems, sourceItems]) => {
          setQueueItems.mutate(
            {
              key: DAY_QUEUE_KEY,
              date,
              taskIds: appendQueueTaskId(
                destinationItems.map((item) => item.taskId),
                taskId,
              ),
            },
            {
              onSuccess: () => {
                if (
                  sourceItems == null ||
                  sourceQueueKey == null ||
                  sourceDate == null
                ) {
                  invalidateWeekQueueItems()
                  return
                }
                setQueueItems.mutate(
                  {
                    key: sourceQueueKey,
                    date: sourceDate,
                    taskIds: sourceItems
                      .map((item) => item.taskId)
                      .filter((id) => id !== taskId),
                  },
                  {
                    onSuccess: invalidateWeekQueueItems,
                    onError: (error: unknown) => {
                      console.error(
                        'Failed to remove task from source queue',
                        error,
                      )
                    },
                  },
                )
              },
              onError: (error: unknown) => {
                console.error('Failed to add task to day queue', error)
              },
            },
          )
        })
        .catch((error: unknown) => {
          console.error('Failed to load queue items for calendar drop', error)
        })
    },
    [getQueueItems, invalidateWeekQueueItems, setQueueItems],
  )

  const moveDayQueueTask = useCallback(
    ({
      taskId,
      sourceDate,
      targetDate,
      revert,
    }: {
      taskId: string
      sourceDate: string
      targetDate: string
      revert: () => void
    }) => {
      if (sourceDate === targetDate) return

      void Promise.all([
        getQueueItems(DAY_QUEUE_KEY, sourceDate),
        getQueueItems(DAY_QUEUE_KEY, targetDate),
      ])
        .then(([sourceItems, targetItems]) => {
          setQueueItems.mutate(
            {
              key: DAY_QUEUE_KEY,
              date: targetDate,
              taskIds: appendQueueTaskId(
                targetItems.map((item) => item.taskId),
                taskId,
              ),
            },
            {
              onSuccess: () => {
                invalidateWeekQueueItems()
                setQueueItems.mutate(
                  {
                    key: DAY_QUEUE_KEY,
                    date: sourceDate,
                    taskIds: sourceItems
                      .map((item) => item.taskId)
                      .filter((id) => id !== taskId),
                  },
                  {
                    onError: (error: unknown) => {
                      revert()
                      console.error('Failed to move task from day queue', error)
                    },
                  },
                )
              },
              onError: (error: unknown) => {
                revert()
                console.error('Failed to move task to day queue', error)
              },
            },
          )
        })
        .catch((error: unknown) => {
          revert()
          console.error('Failed to load day queue items', error)
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
            moveDayQueueTask({
              taskId: info.oldTaskId ?? info.taskId,
              sourceDate: formatLocalDate(info.oldStart),
              targetDate: formatLocalDate(info.newStart),
              revert: info.revert,
            })
          } else {
            createTimeBlock.mutate({
              taskId: info.oldTaskId ?? info.taskId,
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
          addTaskToDayQueue(
            formatLocalDate(start),
            taskId,
            sourceQueueKey,
            sourceDate,
          )
          return
        }
        createTimeBlock.mutate({
          taskId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        })
      },
    }),
    [addTaskToDayQueue, createTimeBlock, moveDayQueueTask, onTimeBlockChange],
  )

  return { dayQueueItems, dndCallbacks }
}
