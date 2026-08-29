import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Button } from '#components/ui/button'
import { DragHandle } from '#components/ui/drag-handle'
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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `candidate-${task.id}`,
      data: { type: 'candidate', taskId: task.id },
    })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const reasonItem = (
    <span
      className={cn(
        'shrink-0 font-mono text-xs',
        reason.kind === 'overdue' ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {formatCandidateReason(reason)}
    </span>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 border-b border-border"
    >
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        aria-label="Drag to today's queue"
      />

      <div className="min-w-0 flex-1">
        <TaskRowAppearance task={task} secondLineExtras={[reasonItem]} />
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onAdd}
        aria-label="Add to today's queue"
        className="mr-1 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
