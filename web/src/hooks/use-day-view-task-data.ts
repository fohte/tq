import { useMemo } from 'react'

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
  queuedTaskIds: ReadonlySet<string>
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
  queuedTaskIds,
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
  const referencedTasksQuery = useTaskList(
    { ids: taskIds, context, includeAncestors: true },
    {
      enabled: taskIds.length > 0,
      placeholderData: (previousData, previousFilter) =>
        selectQueueTaskPlaceholderData(
          previousData,
          previousFilter,
          taskIds,
          context,
        ),
    },
  )
  const candidateTasksQuery = useTaskList({
    context,
    status: 'todo',
    candidatesOn: selectedDateStr,
  })
  const taskDateTasksQuery = useTaskList({
    context,
    status: 'todo',
    dateFrom: visibleRange.startDate,
    dateTo: visibleRange.endDate,
  })
  const todayIsVisible =
    visibleRange.startDate <= todayStr && todayStr <= visibleRange.endDate
  const dueTasksQuery = useTaskList(
    { context, status: 'todo', dueTo: todayStr },
    { enabled: isCompactLayout || todayIsVisible },
  )
  const referencedTasks = useMemo(
    () =>
      (referencedTasksQuery.data ?? []).filter(
        (task) => !task.ancestorOnly || task.context === context,
      ),
    [context, referencedTasksQuery.data],
  )
  const taskMap = useTaskMap(referencedTasks)
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
