import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import type { TaskKanbanColumn } from '#components/kanban/task-kanban'
import { TaskKanban } from '#components/kanban/task-kanban'
import { TaskKanbanSeeAllLink } from '#components/kanban/task-kanban-see-all-link'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useCurrentContext } from '#hooks/use-current-context'
import type { Task, TaskCommitment, TaskListFilter } from '#hooks/use-tasks'
import { taskKeys, useTaskList, useUpdateTask } from '#hooks/use-tasks'

export const Route = createFileRoute('/inbox')({
  component: InboxKanban,
})

// Active/someday are drop targets, not browsing views — only the most
// recently triaged tasks show; the full set stays in the /tasks list.
const RECENT_LIMIT = 5

const COMMITMENTS: TaskCommitment[] = ['inbox', 'active', 'someday']

function isTaskCommitment(value: string): value is TaskCommitment {
  return value === 'inbox' || value === 'active' || value === 'someday'
}

function InboxKanban() {
  const context = useCurrentContext()
  const queryClient = useQueryClient()
  const updateTask = useUpdateTask()

  const columnFilters: Record<TaskCommitment, TaskListFilter> = {
    inbox: { context, commitment: 'inbox', status: 'todo' },
    active: {
      context,
      commitment: 'active',
      status: 'todo',
      sortBy: 'updated',
      limit: RECENT_LIMIT,
    },
    someday: {
      context,
      commitment: 'someday',
      status: 'todo',
      sortBy: 'updated',
      limit: RECENT_LIMIT,
    },
  }

  const inbox = useTaskList(columnFilters.inbox)
  const active = useTaskList(columnFilters.active)
  const someday = useTaskList(columnFilters.someday)

  const columns: TaskKanbanColumn[] = [
    {
      id: 'inbox',
      title: 'Inbox',
      tasks: inbox.categorized.all,
      isLoading: inbox.isLoading,
    },
    {
      id: 'active',
      title: 'Active',
      tasks: active.categorized.all,
      isLoading: active.isLoading,
      showCount: false,
      footer: <TaskKanbanSeeAllLink commitment="active" />,
    },
    {
      id: 'someday',
      title: 'Someday',
      tasks: someday.categorized.all,
      isLoading: someday.isLoading,
      showCount: false,
      footer: <TaskKanbanSeeAllLink commitment="someday" />,
    },
  ]

  // useUpdateTask's own optimistic update only patches the `commitment`
  // field in place inside whichever cached list already contains the task
  // — it doesn't move the task across these commitment-filtered list
  // caches, so without this the card would stay in its source column until
  // the mutation's onSettled refetch lands. onSettled still refetches
  // after this, so a failed request self-corrects rather than needing a
  // manual rollback here.
  const handleDrop = (taskId: string, columnId: string) => {
    if (!isTaskCommitment(columnId)) return

    const sourceCommitment = COMMITMENTS.find(
      (commitment) =>
        queryClient
          .getQueryData<Task[]>(taskKeys.list(columnFilters[commitment]))
          ?.some((task) => task.id === taskId) ?? false,
    )
    const task =
      sourceCommitment != null
        ? queryClient
            .getQueryData<Task[]>(
              taskKeys.list(columnFilters[sourceCommitment]),
            )
            ?.find((t) => t.id === taskId)
        : undefined

    if (sourceCommitment != null && task != null) {
      queryClient.setQueryData<Task[]>(
        taskKeys.list(columnFilters[sourceCommitment]),
        (old) => old?.filter((t) => t.id !== taskId),
      )
      queryClient.setQueryData<Task[]>(
        taskKeys.list(columnFilters[columnId]),
        (old) => [{ ...task, commitment: columnId }, ...(old ?? [])],
      )
    }

    updateTask.mutate({ id: taskId, input: { commitment: columnId } })
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <SectionHeading level={2}>inbox</SectionHeading>
      </ScreenHeaderBar>

      <div className="min-h-0 flex-1">
        <TaskKanban columns={columns} onDrop={handleDrop} />
      </div>
    </div>
  )
}
