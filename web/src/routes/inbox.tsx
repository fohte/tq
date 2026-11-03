import { useQueries, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { InboxKanbanPresentation } from '#components/kanban/inbox-kanban-presentation'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useCurrentContext } from '#hooks/use-current-context'
import type { TaskPriority } from '#hooks/use-priority-settings'
import { usePrioritySettings } from '#hooks/use-priority-settings'
import type { Task, TaskListFilter, TaskPriorityFilter } from '#hooks/use-tasks'
import {
  fetchTaskList,
  taskKeys,
  useTaskList,
  useUpdateTask,
} from '#hooks/use-tasks'

export const Route = createFileRoute('/inbox')({
  component: InboxKanban,
})

const priorityFilterByValue: Record<
  Exclude<TaskPriority, null>,
  TaskPriorityFilter
> = {
  [-1]: '-1',
  0: '0',
  1: '1',
  2: '2',
}

function priorityFilter(priority: TaskPriority): TaskPriorityFilter {
  return priority === null
    ? 'none'
    : (priorityFilterByValue[priority] ?? 'none')
}

function InboxKanban() {
  const context = useCurrentContext()
  const queryClient = useQueryClient()
  const updateTask = useUpdateTask()
  const prioritySettings = usePrioritySettings()
  const settings = prioritySettings.data ?? []

  const priorityFilters = settings.map((setting) => ({
    setting,
    filter: {
      view: 'row',
      context,
      priority: priorityFilter(setting.priority),
      status: 'todo',
      sortBy: setting.priority === null ? 'due' : 'updated',
      limit: 'unlimited',
      q: 'has:no-blockers',
    } as const satisfies TaskListFilter<'row'>,
  }))
  const priorityQueries = useQueries({
    queries: priorityFilters.map(({ filter }) => ({
      queryKey: taskKeys.list(filter),
      queryFn: () => fetchTaskList(filter),
    })),
  })

  const waitingFilter: TaskListFilter<'full'> = {
    view: 'full',
    context,
    status: 'todo',
    sortBy: 'follow-up',
    limit: 'unlimited',
    q: 'has:blockers',
  }
  const waiting = useTaskList(waitingFilter)

  const handleDrop = (taskId: string, nextPriority: TaskPriority) => {
    const source = priorityFilters.find(
      ({ filter }) =>
        queryClient
          .getQueryData<Task[]>(taskKeys.list(filter))
          ?.some((task) => task.id === taskId) ?? false,
    )
    const task =
      source == null
        ? undefined
        : queryClient
            .getQueryData<Task[]>(taskKeys.list(source.filter))
            ?.find((candidate) => candidate.id === taskId)

    if (
      source != null &&
      task != null &&
      source.setting.priority !== nextPriority
    ) {
      const destination = priorityFilters.find(
        ({ setting }) => setting.priority === nextPriority,
      )
      if (destination != null) {
        queryClient.setQueryData<Task[]>(taskKeys.list(source.filter), (old) =>
          old?.filter((candidate) => candidate.id !== taskId),
        )
        queryClient.setQueryData<Task[]>(
          taskKeys.list(destination.filter),
          (old) => [{ ...task, priority: nextPriority }, ...(old ?? [])],
        )
      }
    }

    updateTask.mutate({ id: taskId, input: { priority: nextPriority } })
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <SectionHeading level={2}>inbox</SectionHeading>
      </ScreenHeaderBar>

      <div className="min-h-0 flex-1">
        <InboxKanbanPresentation
          priorityColumns={priorityFilters.map(({ setting }, index) => ({
            setting,
            tasks: priorityQueries[index]?.data ?? [],
            isLoading: priorityQueries[index]?.isLoading ?? false,
          }))}
          waitingTasks={waiting.categorized.all}
          waitingIsLoading={waiting.isLoading}
          waitingHasError={waiting.isError}
          onDrop={handleDrop}
        />
      </div>
    </div>
  )
}
