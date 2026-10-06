import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type CSSProperties, type ReactNode, useRef, useState } from 'react'

import { QueueItemRowAppearance } from '#components/task/queue-item-row-appearance'
import type { Task } from '#hooks/use-tasks'
import { useUpdateTask } from '#hooks/use-tasks'
import { parseDurationToMinutes } from '#lib/parse-duration'

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
  const updateTask = useUpdateTask()
  const [isEditingEstimate, setIsEditingEstimate] = useState(false)
  const [estimateInput, setEstimateInput] = useState('')
  const cancelingRef = useRef(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as CSSProperties

  const commitEstimate = () => {
    if (cancelingRef.current) {
      cancelingRef.current = false
      return
    }
    const parsed = parseDurationToMinutes(estimateInput)
    if (parsed != null) {
      updateTask.mutate({ id: task.id, input: { estimatedMinutes: parsed } })
    }
    setIsEditingEstimate(false)
  }

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
      isEditingEstimate={isEditingEstimate}
      estimateInput={estimateInput}
      onEstimateInputChange={setEstimateInput}
      onStartEditingEstimate={() => {
        setEstimateInput('')
        setIsEditingEstimate(true)
      }}
      onCommitEstimate={commitEstimate}
      onCancelEstimate={() => {
        cancelingRef.current = true
        setIsEditingEstimate(false)
      }}
    />
  )
}
