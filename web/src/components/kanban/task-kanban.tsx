import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { ListAreaMessage } from '#components/ui/list-area-message'
import type { Task } from '#hooks/use-tasks'
import {
  NoDndMouseSensor,
  NoDndTouchSensor,
  useDragOverlayWidth,
} from '#lib/dnd-sensors'
import { resolveKanbanDrop } from '#lib/task-kanban'
import { cn } from '#lib/utils'

export interface TaskKanbanColumn {
  id: string
  title: string
  tasks: Task[]
  isLoading?: boolean
  /** Set false when `tasks` is a truncated subset, so the header doesn't show a count that reads as the true total. */
  showCount?: boolean
  /** e.g. "09-01" for a day queue or "08-31 – 09-06" for a week queue; shown right-aligned in the column header. */
  dateRangeLabel?: string
  /** Rendered below the task list, e.g. a link to the full filtered list. */
  footer?: ReactNode
}

export interface TaskKanbanProps {
  columns: TaskKanbanColumn[]
  onDrop: (taskId: string, columnId: string) => void
}

interface CardDragData extends Record<string, unknown> {
  task: Task
  sourceColumnId: string
}

function isCardDragData(
  data: Record<string, unknown> | undefined,
): data is CardDragData {
  return data?.['task'] != null
}

function TaskKanbanCard({
  task,
  sourceColumnId,
}: {
  task: Task
  sourceColumnId: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task, sourceColumnId } satisfies CardDragData,
    })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
      className="rounded-md border border-border bg-card"
    >
      <TaskRowAppearance task={task} />
    </div>
  )
}

function TaskKanbanColumnView({ column }: { column: TaskKanbanColumn }) {
  const {
    id,
    title,
    tasks,
    isLoading = false,
    showCount = true,
    dateRangeLabel,
    footer,
  } = column
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex w-5/6 shrink-0 snap-start flex-col border-r border-border last:border-r-0 md:w-0 md:flex-1 md:snap-align-none">
      <div
        className={cn(
          'flex h-9 shrink-0 items-center border-b border-border px-3',
          dateRangeLabel != null ? 'gap-2' : 'justify-between',
        )}
      >
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          {title.toUpperCase()}
        </span>
        {showCount && (
          <span className="font-mono text-2xs text-muted-foreground-faint">
            {tasks.length}
          </span>
        )}
        {dateRangeLabel != null && (
          <span className="ml-auto font-mono text-2xs text-muted-foreground-faint">
            {dateRangeLabel}
          </span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2',
          isOver && 'bg-secondary/30',
        )}
      >
        {isLoading ? (
          <ListAreaMessage>Loading...</ListAreaMessage>
        ) : tasks.length === 0 ? (
          <ListAreaMessage>No tasks</ListAreaMessage>
        ) : (
          tasks.map((task) => (
            <TaskKanbanCard key={task.id} task={task} sourceColumnId={id} />
          ))
        )}
      </div>

      {footer != null && (
        <div className="shrink-0 border-t border-border px-3 py-1.5">
          {footer}
        </div>
      )}
    </div>
  )
}

export function TaskKanban({ columns, onDrop }: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const { width: activeWidth, captureWidth, resetWidth } = useDragOverlayWidth()

  const dndSensors = useSensors(
    useSensor(NoDndMouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(NoDndTouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    setActiveTask(isCardDragData(data) ? data.task : null)
    captureWidth(event)
  }

  const resetDragState = () => {
    setActiveTask(null)
    resetWidth()
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current
    if (isCardDragData(data)) {
      const targetColumnId = resolveKanbanDrop(
        data.sourceColumnId,
        event.over != null ? String(event.over.id) : null,
      )
      if (targetColumnId != null) onDrop(data.task.id, targetColumnId)
    }
    resetDragState()
  }

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDragState}
    >
      <div className="flex h-full snap-x snap-mandatory overflow-x-auto md:snap-none">
        {columns.map((column) => (
          <TaskKanbanColumnView key={column.id} column={column} />
        ))}
      </div>

      <DragOverlay>
        {activeTask != null && (
          <div
            style={{ width: activeWidth ?? undefined }}
            className="rounded-md border border-border bg-card shadow-md"
          >
            <TaskRowAppearance task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
