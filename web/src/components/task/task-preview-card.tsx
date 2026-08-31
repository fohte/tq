import { Link } from '@tanstack/react-router'

import { preventClickWhileSelecting } from '#components/task/prevent-click-while-selecting'
import { StatusIcon } from '#components/task/status-icon'
import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { Badge } from '#components/ui/badge'

// Mirrors the label convention in task-status-picker.tsx's STATUS_OPTIONS.
function statusLabel(status: TaskPreviewChipTask['status']): string {
  return status === 'completed' ? 'Completed' : 'Todo'
}

// Shared by TaskMentionCard (`#123`) and TaskUrlCard (a pasted task URL):
// both resolve to the same task shape through different hooks, so only the
// resolution differs, not the rendering.
export function TaskPreviewCard({
  task,
  raw,
}: {
  task: TaskPreviewChipTask | null
  raw: string
}) {
  if (task == null) return <span>{raw}</span>

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      onClick={preventClickWhileSelecting}
      onMouseUp={(event) => {
        event.stopPropagation()
      }}
      className="flex flex-col gap-1.5 border border-border bg-card p-3"
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={task.status} />
        <span className="shrink-0 font-mono text-muted-foreground">
          #{task.number}
        </span>
        <Badge variant="outline">{statusLabel(task.status)}</Badge>
      </div>
      <p className="line-clamp-2 font-sans text-sm font-medium">{task.title}</p>
      {task.description != null && task.description !== '' && (
        <p className="line-clamp-3 font-sans text-xs text-muted-foreground">
          {task.description}
        </p>
      )}
    </Link>
  )
}
