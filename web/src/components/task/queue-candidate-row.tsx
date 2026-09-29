import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import type { Task } from '#hooks/use-tasks'
import {
  type CandidateDragData,
  type CandidateReason,
  formatCandidateReason,
} from '#lib/queue-candidates'
import { cn } from '#lib/utils'

export function CandidateReasonBadge({ reason }: { reason: CandidateReason }) {
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-xs',
        reason.kind === 'overdue' ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {formatCandidateReason(reason)}
    </span>
  )
}

export function QueueCandidateRow({
  task,
  reason,
}: {
  task: Task
  reason: CandidateReason
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `candidate-${task.id}`,
      data: { type: 'candidate', taskId: task.id } satisfies CandidateDragData,
    })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex cursor-grab items-center gap-1 border-b border-border active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex-1">
        <TaskRowAppearance
          task={task}
          secondLineExtras={[<CandidateReasonBadge reason={reason} />]}
        />
      </div>
    </div>
  )
}
