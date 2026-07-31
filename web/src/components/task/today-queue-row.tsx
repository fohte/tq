import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { TaskRow } from '#components/task/task-row'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import type { Task } from '#hooks/use-tasks'
import { useUpdateTask } from '#hooks/use-tasks'
import { formatMinutes, parseDurationToMinutes } from '#lib/parse-duration'

export function TodayQueueRow({
  task,
  onRemove,
}: {
  task: Task
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })
  const updateTask = useUpdateTask()
  const [isEditingEstimate, setIsEditingEstimate] = useState(false)
  const [estimateInput, setEstimateInput] = useState('')
  const cancelingRef = useRef(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 border-b border-border"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        {...attributes}
        {...listeners}
        aria-label="Reorder task"
        className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <TaskRow task={task} draggable={task.status !== 'completed'} />
      </div>

      {task.estimatedMinutes == null &&
        (isEditingEstimate ? (
          <Input
            autoFocus
            value={estimateInput}
            onChange={(e) => {
              setEstimateInput(e.target.value)
            }}
            onBlur={commitEstimate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                cancelingRef.current = true
                setIsEditingEstimate(false)
              }
            }}
            placeholder={formatMinutes(30)}
            className="h-6 w-16 shrink-0 py-0.5 font-mono text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEstimateInput('')
              setIsEditingEstimate(true)
            }}
            title="No estimate set — excluded from auto-scheduling"
            className="shrink-0 whitespace-nowrap border border-destructive px-1.5 py-0.5 font-mono text-[11px] text-destructive"
          >
            No estimate
          </button>
        ))}

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Remove from today's queue"
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
