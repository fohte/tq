import { createFileRoute, Link } from '@tanstack/react-router'
import { buildSearchQuery } from 'api/search-query-parser'

import type { TaskKanbanColumn } from '#components/kanban/task-kanban'
import { TaskKanban } from '#components/kanban/task-kanban'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useCurrentContext } from '#hooks/use-current-context'
import type { TaskCommitment } from '#hooks/use-tasks'
import { useTaskList, useUpdateTask } from '#hooks/use-tasks'

export const Route = createFileRoute('/inbox')({
  component: InboxKanban,
})

// Active/someday are drop targets, not browsing views — only the most
// recently triaged tasks show; the full set stays in the /tasks list.
const RECENT_LIMIT = 5

function isTaskCommitment(value: string): value is TaskCommitment {
  return value === 'inbox' || value === 'active' || value === 'someday'
}

function SeeAllLink({ commitment }: { commitment: TaskCommitment }) {
  return (
    <Link
      to="/tasks"
      search={{
        q: buildSearchQuery({
          freeText: '',
          status: ['todo'],
          commitment,
          sortBy: 'updated',
        }),
      }}
      className="font-mono text-2xs text-muted-foreground hover:text-foreground"
    >
      see all →
    </Link>
  )
}

function InboxKanban() {
  const context = useCurrentContext()
  const updateTask = useUpdateTask()

  const inbox = useTaskList({ context, commitment: 'inbox', status: 'todo' })
  const active = useTaskList({
    context,
    commitment: 'active',
    status: 'todo',
    sortBy: 'updated',
    limit: RECENT_LIMIT,
  })
  const someday = useTaskList({
    context,
    commitment: 'someday',
    status: 'todo',
    sortBy: 'updated',
    limit: RECENT_LIMIT,
  })

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
      footer: <SeeAllLink commitment="active" />,
    },
    {
      id: 'someday',
      title: 'Someday',
      tasks: someday.categorized.all,
      isLoading: someday.isLoading,
      footer: <SeeAllLink commitment="someday" />,
    },
  ]

  const handleDrop = (taskId: string, columnId: string) => {
    if (!isTaskCommitment(columnId)) return
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
