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
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Button } from '#components/ui/button'
import { ListAreaMessage } from '#components/ui/list-area-message'
import type { Task } from '#hooks/use-tasks'
import {
  NoDndMouseSensor,
  NoDndTouchSensor,
  useDragOverlayWidth,
} from '#lib/dnd-sensors'
import {
  formatCandidateReason,
  type QueueCandidate,
} from '#lib/queue-candidates'
import {
  resolveKanbanCandidateDrop,
  resolveKanbanCardDrop,
} from '#lib/task-kanban'
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
  /** Enables drag-to-reorder within a column; omit for a board with no user-defined order (e.g. inbox). */
  onReorder?: (columnId: string, taskIds: string[]) => void
  /** Rendered as a trailing column that cards can be dragged from into any other column; omit for a board with no candidates concept (e.g. inbox). */
  candidates?: QueueCandidate<Task>[]
  onAddCandidate?: (taskId: string) => void
  onInsertCandidate?: (columnId: string, taskId: string, index: number) => void
}

interface CardDragData extends Record<string, unknown> {
  task: Task
  sourceColumnId: string
}

interface CandidateDragData extends Record<string, unknown> {
  type: 'candidate'
  taskId: string
}

function isCardDragData(
  data: Record<string, unknown> | undefined,
): data is CardDragData {
  return data?.['task'] != null
}

function isCandidateDragData(
  data: Record<string, unknown> | undefined,
): data is CandidateDragData {
  return data?.['type'] === 'candidate'
}

function TaskKanbanCard({
  task,
  sourceColumnId,
  sortable,
}: {
  task: Task
  sourceColumnId: string
  /** False disables this card as a reorder target (its position among siblings can't be dropped on) while still allowing it to be dragged out — used when the board has no `onReorder` (e.g. inbox). */
  sortable: boolean
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
    data: { task, sourceColumnId } satisfies CardDragData,
    disabled: { droppable: !sortable },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
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

function TaskKanbanCandidateCard({
  candidate,
  onAdd,
}: {
  candidate: QueueCandidate<Task>
  onAdd: (taskId: string) => void
}) {
  const { task, reason } = candidate
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `candidate-${task.id}`,
      data: { type: 'candidate', taskId: task.id } satisfies CandidateDragData,
    })

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
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-1 rounded-md border border-border bg-card"
    >
      <div className="min-w-0 flex-1">
        <TaskRowAppearance task={task} secondLineExtras={[reasonItem]} />
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        data-no-dnd=""
        onClick={() => {
          onAdd(task.id)
        }}
        aria-label="Add to today's queue"
        className="mr-1 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function TaskKanbanColumnView({
  column,
  reorderEnabled,
}: {
  column: TaskKanbanColumn
  reorderEnabled: boolean
}) {
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
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <TaskKanbanCard
                key={task.id}
                task={task}
                sourceColumnId={id}
                sortable={reorderEnabled}
              />
            ))}
          </SortableContext>
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

function TaskKanbanCandidatesColumn({
  candidates,
  onAdd,
}: {
  candidates: QueueCandidate<Task>[]
  onAdd: (taskId: string) => void
}) {
  return (
    <div className="flex w-5/6 shrink-0 snap-start flex-col border-r border-border last:border-r-0 md:w-0 md:flex-1 md:snap-align-none">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          CANDIDATES
        </span>
        <span className="font-mono text-2xs text-muted-foreground-faint">
          {candidates.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {candidates.map((candidate) => (
          <TaskKanbanCandidateCard
            key={candidate.task.id}
            candidate={candidate}
            onAdd={onAdd}
          />
        ))}
      </div>
    </div>
  )
}

export function TaskKanban({
  columns,
  onDrop,
  onReorder,
  candidates,
  onAddCandidate,
  onInsertCandidate,
}: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const { width: activeWidth, captureWidth, resetWidth } = useDragOverlayWidth()
  const reorderEnabled = onReorder != null

  const dndSensors = useSensors(
    useSensor(NoDndMouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(NoDndTouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (isCardDragData(data)) {
      setActiveTask(data.task)
    } else if (isCandidateDragData(data)) {
      setActiveTask(
        candidates?.find((c) => c.task.id === data.taskId)?.task ?? null,
      )
    } else {
      setActiveTask(null)
    }
    captureWidth(event)
  }

  const resetDragState = () => {
    setActiveTask(null)
    resetWidth()
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const data = active.data.current

    if (over != null) {
      const overId = String(over.id)
      const columnTaskIds = columns.map((c) => ({
        id: c.id,
        taskIds: c.tasks.map((t) => t.id),
      }))

      if (isCandidateDragData(data)) {
        if (onInsertCandidate != null) {
          const activeTop = active.rect.current.translated?.top ?? over.rect.top
          const isAfter = activeTop > over.rect.top + over.rect.height / 2
          const result = resolveKanbanCandidateDrop(
            columnTaskIds,
            overId,
            isAfter,
          )
          if (result != null) {
            onInsertCandidate(result.columnId, data.taskId, result.index)
          }
        }
      } else if (isCardDragData(data)) {
        const result = resolveKanbanCardDrop(
          columnTaskIds,
          data.sourceColumnId,
          data.task.id,
          overId,
        )
        if (result?.type === 'move') {
          onDrop(data.task.id, result.columnId)
        } else if (result?.type === 'reorder' && onReorder != null) {
          onReorder(result.columnId, result.taskIds)
        }
      }
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
          <TaskKanbanColumnView
            key={column.id}
            column={column}
            reorderEnabled={reorderEnabled}
          />
        ))}

        {candidates != null &&
          candidates.length > 0 &&
          onAddCandidate != null && (
            <TaskKanbanCandidatesColumn
              candidates={candidates}
              onAdd={onAddCandidate}
            />
          )}
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
