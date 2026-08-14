import { Link } from '@tanstack/react-router'

import { preventClickWhileSelecting } from '#components/task/prevent-click-while-selecting'
import { StatusIcon } from '#components/task/status-icon'
import { Badge } from '#components/ui/badge'
import { useTaskUrlPreview } from '#hooks/use-task-url-preview'
import type { Task } from '#hooks/use-tasks'
import type { TaskUrlData } from '#lib/inline-reference/providers/task-url'

// Mirrors the label convention in task-status-picker.tsx's STATUS_OPTIONS.
const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export function TaskUrlCard({ data, raw }: { data: TaskUrlData; raw: string }) {
  const { data: task } = useTaskUrlPreview(data.url)

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
        <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
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
