import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { FocusViewPresentation } from '#components/focus/focus-view'
import { useCurrentContext } from '#hooks/use-current-context'
import { useLiveToday } from '#hooks/use-live-today'
import {
  DAY_QUEUE_KEY,
  useQueueCarryOver,
  useQueueItems,
  useSetQueueItems,
} from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'
import { useTaskList, useTaskMap } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { sortQueueTasksByDue } from '#lib/queue-task-due-order'
import { sortQueueItemsBySortOrder } from '#lib/queue-task-order'
import { selectQueueTaskPlaceholderData } from '#lib/queue-task-placeholder'

export const Route = createFileRoute('/today')({
  component: TodayFocus,
})

export function TodayFocus() {
  const context = useCurrentContext()

  const liveToday = useLiveToday()
  const todayStr = useMemo(() => formatLocalDate(liveToday), [liveToday])
  const queueCarryOver = useQueueCarryOver(todayStr)

  const { data: todayTasksData, isLoading: isTodayTasksLoading } =
    useQueueItems(DAY_QUEUE_KEY, todayStr, {
      enabled: queueCarryOver.canReadQueueItems,
      context,
    })
  const queueItemsInSortOrder = useMemo(
    () => sortQueueItemsBySortOrder(todayTasksData ?? []),
    [todayTasksData],
  )
  const queueTaskIds = useMemo(
    () => [...new Set(queueItemsInSortOrder.map((item) => item.taskId))],
    [queueItemsInSortOrder],
  )
  const queueTasksQuery = useTaskList(
    {
      ids: queueTaskIds,
      context,
      status: 'all',
      limit: 'unlimited',
    },
    {
      enabled:
        queueCarryOver.canReadQueueItems &&
        todayTasksData != null &&
        queueTaskIds.length > 0,
      placeholderData: (previousData, previousFilter) =>
        selectQueueTaskPlaceholderData(
          previousData,
          previousFilter,
          queueTaskIds,
          context,
        ),
    },
  )
  const taskMap = useTaskMap(queueTasksQuery.data ?? [])
  const queueTasks = useMemo(
    () =>
      sortQueueTasksByDue(
        queueTasksQuery.isPlaceholderData
          ? queueTasksQuery.data
          : queueItemsInSortOrder
              .map((item) => taskMap.get(item.taskId))
              .filter((task): task is Task => task != null),
      ),
    [
      queueItemsInSortOrder,
      queueTasksQuery.data,
      queueTasksQuery.isPlaceholderData,
      taskMap,
    ],
  )

  const focusTask = useMemo(
    () => queueTasks.find((t) => t.status !== 'completed') ?? null,
    [queueTasks],
  )
  const subtasksQuery = useTaskList(
    {
      ...(focusTask == null ? {} : { parentId: focusTask.id }),
      context,
      status: 'all',
      limit: 'unlimited',
    },
    { enabled: focusTask != null },
  )

  const nextTask = useMemo(() => {
    if (!focusTask) return null
    const focusIndex = queueTasks.findIndex((t) => t.id === focusTask.id)
    return (
      queueTasks.slice(focusIndex + 1).find((t) => t.status !== 'completed') ??
      null
    )
  }, [queueTasks, focusTask])

  const subtasks = subtasksQuery.data ?? []
  const isLoading =
    queueCarryOver.isCarryingOver ||
    isTodayTasksLoading ||
    queueTasksQuery.isLoading

  const setQueueItems = useSetQueueItems()

  const handleDefer = (taskId: string) => {
    if (setQueueItems.isPending) return
    setQueueItems.mutate({
      key: DAY_QUEUE_KEY,
      date: todayStr,
      taskIds: queueItemsInSortOrder
        .map((t) => t.taskId)
        .filter((id) => id !== taskId),
    })
  }

  return (
    <FocusViewPresentation
      isLoading={isLoading}
      queueTasks={queueTasks}
      focusTask={focusTask}
      nextTask={nextTask}
      subtasks={subtasks}
      subtasksError={subtasksQuery.isError}
      onDefer={handleDefer}
    />
  )
}
