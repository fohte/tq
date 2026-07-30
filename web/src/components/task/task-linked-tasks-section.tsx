import { Link } from '@tanstack/react-router'
import { Link2 } from 'lucide-react'

import { StatusIcon } from '#components/task/status-icon'
import type { LinkedTaskSummary } from '#hooks/use-tasks'

function LinkedTaskRow({ task }: { task: LinkedTaskSummary }) {
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary/50"
    >
      <StatusIcon status={task.status} />
      <span className="shrink-0 text-muted-foreground">#{task.number}</span>
      <span className="truncate">{task.title}</span>
    </Link>
  )
}

function LinkedTaskGroup({
  label,
  tasks,
}: {
  label: string
  tasks: LinkedTaskSummary[]
}) {
  if (tasks.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <LinkedTaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

export function TaskLinkedTasksSection({
  outgoing,
  incoming,
}: {
  outgoing: LinkedTaskSummary[]
  incoming: LinkedTaskSummary[]
}) {
  const isEmpty = outgoing.length === 0 && incoming.length === 0

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Link2 className="size-3.5" />
        Linked Tasks
      </h3>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No linked tasks. Mention a task with #123 in the description, a page,
          or a comment to link it.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <LinkedTaskGroup label="Mentions" tasks={outgoing} />
          <LinkedTaskGroup label="Mentioned by" tasks={incoming} />
        </div>
      )}
    </div>
  )
}
