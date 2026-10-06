import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core'
import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Chip } from '#components/ui/chip'
import type { Task } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { cn } from '#lib/utils'

export function QueueItemRowAppearance({
  task,
  queueKey,
  queueDate,
  onRemove,
  attributes,
  listeners,
  setNodeRef,
  style,
  isDragging = false,
  isEditingEstimate,
  estimateInput,
  secondLineExtras = [],
  isCurrentTimeBlock = false,
  onEstimateInputChange,
  onStartEditingEstimate,
  onCommitEstimate,
  onCancelEstimate,
}: {
  task: Task
  queueKey: string
  queueDate: string
  onRemove: () => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  setNodeRef: (node: HTMLElement | null) => void
  style: CSSProperties
  isDragging?: boolean
  isEditingEstimate: boolean
  estimateInput: string
  secondLineExtras?: ReactNode[]
  isCurrentTimeBlock?: boolean
  onEstimateInputChange: (value: string) => void
  onStartEditingEstimate: () => void
  onCommitEstimate: () => void
  onCancelEstimate: () => void
}) {
  // The value itself renders through TaskRowAppearance's own second line;
  // this only supplies the null-estimate affordances (chip / input).
  const estimateItem =
    task.estimatedMinutes != null ? null : isEditingEstimate ? (
      <Input
        autoFocus
        data-no-dnd=""
        value={estimateInput}
        onChange={(e) => {
          onEstimateInputChange(e.target.value)
        }}
        onBlur={onCommitEstimate}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') onCancelEstimate()
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        placeholder={formatMinutes(30)}
        className="h-6 w-16 shrink-0 py-0.5 font-mono text-xs"
      />
    ) : (
      <Chip
        as="button"
        size="md"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onStartEditingEstimate()
        }}
        data-no-dnd=""
        title="No estimate set — excluded from auto-scheduling"
        className="shrink-0 whitespace-nowrap border-destructive text-destructive"
      >
        No estimate
      </Chip>
    )

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-queue-key={queueKey}
      data-queue-date={queueDate}
      className={cn(
        'flex cursor-grab items-center gap-1 border-b border-border active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex-1">
        <TaskRowAppearance
          task={task}
          draggable={task.status !== 'completed'}
          secondLineExtras={[estimateItem, ...secondLineExtras]}
          isCurrentTimeBlock={isCurrentTimeBlock}
        />
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Remove from queue"
        data-no-dnd=""
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
