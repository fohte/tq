import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core'
import { Button } from '@fohte/ui/button'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import type { Task } from '#hooks/use-tasks'
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
  secondLineExtras = [],
  isCurrentTimeBlock = false,
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
  secondLineExtras?: ReactNode[]
  isCurrentTimeBlock?: boolean
}) {
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
          secondLineExtras={secondLineExtras}
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
