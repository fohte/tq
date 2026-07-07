import { createFileRoute } from '@tanstack/react-router'
import { FocusViewPresentation } from '@web/components/focus/focus-view'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskList, useTaskMap } from '@web/hooks/use-tasks'
import { useTodayTasks } from '@web/hooks/use-today-tasks'
import { formatLocalDate } from '@web/lib/date-range'
import { useMemo } from 'react'

export const Route = createFileRoute('/today')({
  component: TodayFocus,
})

export function TodayFocus() {
  const { isLoading, categorized } = useTaskList()

  const todayStr = useMemo(() => formatLocalDate(new Date()), [])

  const { data: todayTasksData } = useTodayTasks(todayStr)

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
