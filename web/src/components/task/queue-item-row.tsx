import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type CSSProperties, type ReactNode } from 'react'

import { QueueItemRowAppearance } from '#components/task/queue-item-row-appearance'
import type { Task } from '#hooks/use-tasks'

export interface QueueTaskDragData extends Record<string, unknown> {
  type: 'queue-task'
  queueKey: string
}

export function QueueItemRow({
  task,
  queueKey,
  queueDate,
  onRemove,
  secondLineExtras = [],
  isCurrentTimeBlock = false,
}: {
  task: Task
  /** The queue this row belongs to, carried in drag data so a shared
   * DndContext across multiple sections can tell which queue a drag started
   * in. */
  queueKey: string
  queueDate: string
  onRemove: () => void
  secondLineExtras?: ReactNode[]
  isCurrentTimeBlock?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'queue-task', queueKey } satisfies QueueTaskDragData,
    // Queue rows stay draggable for cross-queue moves; drops target the section.
    disabled: { droppable: true },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as CSSProperties

  return (
    <QueueItemRowAppearance
      task={task}
      queueKey={queueKey}
      queueDate={queueDate}
      secondLineExtras={secondLineExtras}
      isCurrentTimeBlock={isCurrentTimeBlock}
      onRemove={onRemove}
      attributes={attributes}
      listeners={listeners}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
    />
  )
}
