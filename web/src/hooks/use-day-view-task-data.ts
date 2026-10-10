import { useEffect, useMemo } from 'react'

import type { QueueItem } from '#hooks/use-queues'
import type { TaskContext } from '#hooks/use-tasks'
import { useTaskList, useTaskMap } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { formatLocalDate } from '#lib/date-range'
import { getQueueCandidates } from '#lib/queue-candidates'
import { selectQueueTaskPlaceholderData } from '#lib/queue-task-placeholder'

interface UseDayViewTaskDataOptions {
  context: TaskContext
  selectedDate: Date
  visibleRange: { startDate: string; endDate: string }
  queueItems: QueueItem[]
  visibleDayQueueItems: { item: QueueItem }[]
  visibleTimeBlocks: TimeBlock[] | undefined
  nowPanelTimeBlocks: TimeBlock[] | undefined
  isCompactLayout: boolean
}

export function useDayViewTaskData({
  context,
  selectedDate,
  visibleRange,
  queueItems,
  visibleDayQueueItems,
  visibleTimeBlocks,
  nowPanelTimeBlocks,
  isCompactLayout,
}: UseDayViewTaskDataOptions) {
  const selectedDateStr = formatLocalDate(selectedDate)
  const todayStr = formatLocalDate(new Date())
  const taskIds = useMemo(
    () =>
      [
        ...new Set([
          ...queueItems.map((item) => item.taskId),
          ...visibleDayQueueItems.map(({ item }) => item.taskId),
          ...(visibleTimeBlocks ?? []).map((block) => block.taskId),
          ...(nowPanelTimeBlocks ?? []).map((block) => block.taskId),
        ]),
      ].sort(),
    [nowPanelTimeBlocks, queueItems, visibleDayQueueItems, visibleTimeBlocks],
  )
  const queuedTaskIds = useMemo(
    () => new Set(queueItems.map((item) => item.taskId)),
    [queueItems],
  )
  const candidateTasksQuery = useTaskList({
    view: 'row',
    context,
    status: 'todo',
    candidatesOn: selectedDateStr,
    limit: 'unlimited',
  })
  const taskDateTasksQuery = useTaskList({
    view: 'row',
    context,
    status: 'todo',
    dateFrom: visibleRange.startDate,
    dateTo: visibleRange.endDate,
    limit: 'unlimited',
  })
  const todayIsVisible =
    visibleRange.startDate <= todayStr && todayStr <= visibleRange.endDate
  const shouldFetchDueTasks = isCompactLayout || todayIsVisible
  const dueTasksQuery = useTaskList(
    {
      view: 'row',
      context,
      status: 'todo',
      dueTo: todayStr,
      sortBy: 'due',
      limit: 'unlimited',
    },
    { enabled: shouldFetchDueTasks },
  )
  const referencedTasksQuery = useTaskList(
    {
      view: 'row',
      ids: taskIds,
      context,
      status: 'all',
      limit: 'unlimited',
      includeAncestors: true,
    },
    {
      enabled: taskIds.length > 0,
      placeholderData: (previousData, previousFilter) => {
        const previousTasks = selectQueueTaskPlaceholderData(
          previousData,
          previousFilter,
          taskIds,
          context,
        )
        if (previousTasks == null) return undefined

        return Array.from(
          new Map(
            [
              ...previousTasks,
              ...(candidateTasksQuery.data ?? []),
              ...(taskDateTasksQuery.data ?? []),
              ...(dueTasksQuery.data ?? []),
            ].map((task) => [task.id, task]),
          ).values(),
        )
      },
    },
  )
  const referencedTasks = useMemo(
    () =>
      (referencedTasksQuery.data ?? []).filter(
        (task) => !task.ancestorOnly || task.context === context,
      ),
    [context, referencedTasksQuery.data],
  )
  useEffect(() => {
    if (candidateTasksQuery.error == null) return
    console.error(
      'Failed to fetch day-view queue candidates',
      candidateTasksQuery.error,
    )
  }, [candidateTasksQuery.error])
  useEffect(() => {
    if (taskDateTasksQuery.error == null) return
    console.error(
      'Failed to fetch day-view task dates',
      taskDateTasksQuery.error,
    )
  }, [taskDateTasksQuery.error])
  useEffect(() => {
    if (isCompactLayout || !todayIsVisible || dueTasksQuery.error == null) {
      return
    }
    console.error('Failed to fetch day-view overdue tasks', dueTasksQuery.error)
  }, [dueTasksQuery.error, isCompactLayout, todayIsVisible])
  const tasksForTaskMap = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...(candidateTasksQuery.data ?? []),
            ...(taskDateTasksQuery.data ?? []),
            ...(dueTasksQuery.data ?? []),
            ...referencedTasks,
          ].map((task) => [task.id, task]),
        ).values(),
      ),
    [
      candidateTasksQuery.data,
      dueTasksQuery.data,
      referencedTasks,
      taskDateTasksQuery.data,
    ],
  )
  const taskMap = useTaskMap(tasksForTaskMap)
  const queueCandidates = useMemo(
    () =>
      getQueueCandidates(
        candidateTasksQuery.data ?? [],
        queuedTaskIds,
        selectedDate,
      ),
    [candidateTasksQuery.data, queuedTaskIds, selectedDate],
  )
  const taskDateTasks = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...(taskDateTasksQuery.data ?? []),
            ...(dueTasksQuery.data ?? []),
          ].map((task) => [task.id, task]),
        ).values(),
      ),
    [taskDateTasksQuery.data, dueTasksQuery.data],
  )

  return {
    taskMap,
    isLoading:
      referencedTasksQuery.isLoading ||
      candidateTasksQuery.isLoading ||
      taskDateTasksQuery.isLoading ||
      dueTasksQuery.isLoading,
    queueCandidates,
    taskDateTasks,
    tasksDueOnOrBeforeToday: dueTasksQuery.data ?? [],
    dueTasksError: dueTasksQuery.error,
  }
}
