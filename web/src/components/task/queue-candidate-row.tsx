import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { Button } from '#components/ui/button'
import type { Task } from '#hooks/use-tasks'
import {
  type CandidateReason,
  formatCandidateReason,
} from '#lib/queue-candidates'
import { cn } from '#lib/utils'

export function QueueCandidateRow({
  task,
  reason,
  onAdd,
}: {
  task: Task
  reason: CandidateReason
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <Link
        to="/tasks/$taskId"
        params={{ taskId: task.id }}
        className="min-w-0 flex-1 truncate text-sm hover:underline"
      >
        {task.title}
      </Link>

      <span
        className={cn(
          'shrink-0 font-mono text-xs',
          reason.kind === 'overdue' ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {formatCandidateReason(reason)}
      </span>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onAdd}
        aria-label="Add to today's queue"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
