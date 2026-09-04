import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { FocusViewPresentation } from '#components/focus/focus-view'
import { useBaseFilter } from '#hooks/use-filtered-tasks'
import { useQueueItems, useSetQueueItems } from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'
import { useTaskList, useTaskMap } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'

// Auto-assign and the focus view (/today) depend on this key by name — see
// api/src/services/task-queues.ts's DAY_QUEUE_KEY for the backend side of
// the same special-casing.
const DAY_QUEUE_KEY = 'day'

export const Route = createFileRoute('/today')({
  component: TodayFocus,
})

export function TodayFocus() {
  const baseFilter = useBaseFilter(true)
  const { isLoading: isTaskListLoading, categorized } = useTaskList(baseFilter)

  const todayStr = useMemo(() => formatLocalDate(new Date()), [])

  const { data: todayTasksData, isLoading: isTodayTasksLoading } =
    useQueueItems(DAY_QUEUE_KEY, todayStr)
  const isLoading = isTaskListLoading || isTodayTasksLoading

  const setQueueItems = useSetQueueItems()

  const taskMap = useTaskMap(categorized.all)

  const queueTasks = useMemo(
    () =>
      (todayTasksData ?? [])
        .map((t) => taskMap.get(t.taskId))
        .filter((t): t is Task => t != null),
    [todayTasksData, taskMap],
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
      taskIds: (todayTasksData ?? [])
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
