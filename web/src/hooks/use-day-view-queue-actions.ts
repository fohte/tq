import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import {
  DAY_QUEUE_KEY,
  type Queue,
  type QueueItem,
  queueKeys,
  useSetQueueItems,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import { appendQueueTaskId } from '#lib/queue-task-order'

interface UseDayViewQueueActionsOptions {
  queues: Queue[] | undefined
  queueItemsResults: { data: QueueItem[] | undefined }[]
  rawItemsByKey: ReadonlyMap<string, QueueItem[]>
  selectedDate: string
  setQueueItems: ReturnType<typeof useSetQueueItems>
  isQueueTransitioning: boolean
  dndCallbacks: CalendarDndCallbacks
}

export function useDayViewQueueActions({
  queues,
  queueItemsResults,
  rawItemsByKey,
  selectedDate,
  setQueueItems,
  isQueueTransitioning,
  dndCallbacks,
}: UseDayViewQueueActionsOptions) {
  const queryClient = useQueryClient()

  const appendedTaskIdsFor = (queueKey: string, taskId: string) => {
    if (isQueueTransitioning) return null
    if (setQueueItems.isPending && setQueueItems.variables.key === queueKey)
      return null
    const taskIds = (rawItemsByKey.get(queueKey) ?? []).map(
      (item) => item.taskId,
    )
    return appendQueueTaskId(taskIds, taskId)
  }

  const handleInsertCandidate = (queueKey: string, taskId: string) => {
    const taskIds = appendedTaskIdsFor(queueKey, taskId)
    if (taskIds == null) return
    setQueueItems.mutate({ key: queueKey, date: selectedDate, taskIds })
  }

  const handleAddCandidate = (taskId: string) => {
    handleInsertCandidate(DAY_QUEUE_KEY, taskId)
  }

  const handleRemoveFromQueue = (queueKey: string, taskId: string) => {
    if (isQueueTransitioning) return
    if (setQueueItems.isPending && setQueueItems.variables.key === queueKey)
      return
    const rawIds = (rawItemsByKey.get(queueKey) ?? []).map(
      (item) => item.taskId,
    )
    setQueueItems.mutate({
      key: queueKey,
      date: selectedDate,
      taskIds: rawIds.filter((id) => id !== taskId),
    })
  }

  const handleMoveScheduledTaskToWeek = (taskId: string, date: string) => {
    if (isQueueTransitioning) return
    const weekQueueIndex =
      queues?.findIndex((queue) => queue.key === WEEK_QUEUE_KEY) ?? -1
    if (
      weekQueueIndex === -1 ||
      queueItemsResults[weekQueueIndex]?.data == null
    )
      return
    const taskIds = appendedTaskIdsFor(WEEK_QUEUE_KEY, taskId)
    if (taskIds == null) return
    setQueueItems.mutate(
      { key: WEEK_QUEUE_KEY, date, taskIds },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: [...queueKeys.all, WEEK_QUEUE_KEY, 'items'],
          })
          void queryClient.invalidateQueries({
            queryKey: queueKeys.itemsForQueue(DAY_QUEUE_KEY),
          })
        },
      },
    )
  }

  const handleMoveTask = (
    taskId: string,
    fromQueueKey: string,
    toQueueKey: string,
  ) => {
    const taskIds = appendedTaskIdsFor(toQueueKey, taskId)
    if (taskIds == null) return
    setQueueItems.mutate(
      {
        key: toQueueKey,
        date: selectedDate,
        taskIds,
      },
      {
        onSuccess: () => {
          // The server enforces "at most one queue per task" itself and
          // already dropped this task from fromQueueKey's stored selection
          // — patch its cached items locally instead of refetching so the
          // UI doesn't show the task in both sections until the next fetch.
          queryClient.setQueriesData<QueueItem[]>(
            { queryKey: queueKeys.items(fromQueueKey, selectedDate) },
            (old: QueueItem[] | undefined) =>
              old?.filter((item) => item.taskId !== taskId) ?? old,
          )
          queryClient.setQueriesData<QueueItem[]>(
            {
              queryKey: queueKeys.itemsForQueue(fromQueueKey),
              predicate: ({ queryKey }) =>
                queueKeys.rangeContainsDate(
                  queryKey,
                  fromQueueKey,
                  selectedDate,
                ),
            },
            (old: QueueItem[] | undefined) =>
              old?.filter(
                (item) =>
                  item.taskId !== taskId || item.periodStart !== selectedDate,
              ) ?? old,
          )
        },
      },
    )
  }

  const transitionDndCallbacks = useMemo<CalendarDndCallbacks>(
    () => ({
      ...dndCallbacks,
      onEventDrop: (info) => {
        if (
          isQueueTransitioning &&
          info.eventType === 'day-queue' &&
          info.wasAllDay &&
          info.isAllDay
        ) {
          info.revert()
          return
        }
        dndCallbacks.onEventDrop?.(info)
      },
      onExternalDrop: (info) => {
        if (isQueueTransitioning && info.allDay) return
        dndCallbacks.onExternalDrop?.(info)
      },
    }),
    [dndCallbacks, isQueueTransitioning],
  )

  return {
    dndCallbacks: transitionDndCallbacks,
    handleAddCandidate,
    handleInsertCandidate,
    handleMoveScheduledTaskToWeek,
    handleMoveTask,
    handleRemoveFromQueue,
  }
}
