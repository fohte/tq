import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { FocusViewPresentation } from '#components/focus/focus-view'
import type { Task } from '#hooks/use-tasks'
import { useTaskList, useTaskMap } from '#hooks/use-tasks'
import { useTodayTasks } from '#hooks/use-today-tasks'
import { formatLocalDate } from '#lib/date-range'

export const Route = createFileRoute('/today')({
  component: TodayFocus,
})

export function TodayFocus() {
  const { isLoading: isTaskListLoading, categorized } = useTaskList()

  const todayStr = useMemo(() => formatLocalDate(new Date()), [])

  const { data: todayTasksData, isLoading: isTodayTasksLoading } =
    useTodayTasks(todayStr)
  const isLoading = isTaskListLoading || isTodayTasksLoading

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

  return (
    <FocusViewPresentation
      isLoading={isLoading}
      queueTasks={queueTasks}
      focusTask={focusTask}
      nextTask={nextTask}
      subtasks={subtasks}
    />
  )
}
