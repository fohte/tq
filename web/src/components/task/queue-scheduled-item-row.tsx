import { Button } from '@fohte/ui/button'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'

import { DAY_QUEUE_KEY } from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'

export function QueueScheduledItemRow({
  task,
  date,
  onRemove,
}: {
  task: Task
  date: string
  onRemove: () => void
}) {
  return (
    <div
      data-queue-key={DAY_QUEUE_KEY}
      data-queue-date={date}
      className="flex min-h-8 cursor-grab items-center gap-2 border-b border-border px-3 py-1 text-sm"
    >
      <Link
        to="/tasks/$taskId"
        params={{ taskId: task.id }}
        data-task-id={task.id}
        data-task-title={task.title}
        {...(task.estimatedMinutes == null
          ? {}
          : { 'data-estimated-minutes': String(task.estimatedMinutes) })}
        className="min-w-0 flex-1 truncate text-muted-foreground hover:text-foreground"
      >
        {task.title}
      </Link>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label={`Remove day from ${task.title}`}
        title="Remove day"
        data-no-dnd=""
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
