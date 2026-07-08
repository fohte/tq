import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskRow } from '@web/components/task/task-row'
import type { Task } from '@web/hooks/use-tasks'
import { useUpdateTask } from '@web/hooks/use-tasks'
import { formatMinutes, parseDurationToMinutes } from '@web/lib/parse-duration'
import { GripVertical, X } from 'lucide-react'
import { useRef, useState } from 'react'

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
      data-testid="today-queue-row"
      className="flex items-center gap-1 border-b border-border"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder task"
        className="flex shrink-0 touch-none cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <TaskRow task={task} draggable={task.status !== 'completed'} />
      </div>

      {task.estimatedMinutes == null &&
        (isEditingEstimate ? (
          <input
            type="text"
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
            className="w-16 shrink-0 rounded border border-border bg-transparent px-1 py-0.5 font-mono text-xs outline-none focus:border-primary/50"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEstimateInput('')
              setIsEditingEstimate(true)
            }}
            title="No estimate set — excluded from auto-scheduling"
            className="shrink-0 whitespace-nowrap rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
          >
            No estimate
          </button>
        ))}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from today's queue"
        className="shrink-0 px-2 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
