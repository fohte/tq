import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import { FocusViewPresentation } from '#components/focus/focus-view'
import { useBaseFilter } from '#hooks/use-filtered-tasks'
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

export const Route = createFileRoute('/today')({
  component: TodayFocus,
})

export function TodayFocus() {
  const baseFilter = useBaseFilter(true)
  const { isLoading: isTaskListLoading, categorized } = useTaskList(baseFilter)

  const liveToday = useLiveToday()
  const todayStr = useMemo(() => formatLocalDate(liveToday), [liveToday])
  const queueCarryOver = useQueueCarryOver(todayStr)
  useEffect(() => {
    if (queueCarryOver.error == null) return
    console.error('Failed to carry over queue items', queueCarryOver.error)
  }, [queueCarryOver.error])

  const { data: todayTasksData, isLoading: isTodayTasksLoading } =
    useQueueItems(DAY_QUEUE_KEY, todayStr, {
      enabled: queueCarryOver.isSuccess || queueCarryOver.isError,
    })
  const isLoading =
    isTaskListLoading || queueCarryOver.isPending || isTodayTasksLoading

  const setQueueItems = useSetQueueItems()

  const taskMap = useTaskMap(categorized.all)
  const queueItemsInSortOrder = useMemo(
    () => sortQueueItemsBySortOrder(todayTasksData ?? []),
    [todayTasksData],
  )

  const queueTasks = useMemo(
    () =>
      sortQueueTasksByDue(
        queueItemsInSortOrder
          .map((t) => taskMap.get(t.taskId))
          .filter((t): t is Task => t != null),
      ),
    [queueItemsInSortOrder, taskMap],
  )

  const focusTask = useMemo(
    () => queueTasks.find((t) => t.status !== 'completed') ?? null,
    [queueTasks],
  )

  const nextTask = useMemo(() => {
    if (!focusTask) return null
    const focusIndex = queueTasks.findIndex((t) => t.id === focusTask.id)
    return (
      queueTasks.slice(focusIndex + 1).find((t) => t.status !== 'completed') ??
      null
    )
  }, [queueTasks, focusTask])

  const subtasks = useMemo(() => {
    if (!focusTask) return []
    return categorized.all.filter((t) => t.parentId === focusTask.id)
  }, [categorized.all, focusTask])

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
      onDefer={handleDefer}
    />
  )
}
