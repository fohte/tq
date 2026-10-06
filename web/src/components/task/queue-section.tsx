import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Chip } from '@fohte/ui/chip'

import { QueueItemRow } from '#components/task/queue-item-row'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import {
  getTaskRowTimeBlockExtras,
  type TaskRowTimeBlockState,
} from '#components/task/task-row-time-block'
import type { Task } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export interface QueueSectionProps {
  /** Droppable id for this section, e.g. `day` or `week` — lets the parent's onDragEnd tell which section a task was dropped on. */
  queueKey: string
  queueDate?: string
  title: string
  items: Task[]
  /** e.g. "09-01" for a day queue or "08-31 – 09-06" for a week queue; omit for a queue with no periodUnit. */
  dateRangeLabel?: string
  isReadOnly?: boolean
  taskRowStates?: ReadonlyMap<string, TaskRowTimeBlockState>
  onRemove: (taskId: string) => void
  emptyMessage: string
}

export function QueueSection({
  queueKey,
  queueDate,
  title,
  items,
  dateRangeLabel,
  isReadOnly = false,
  taskRowStates,
  onRemove,
  emptyMessage,
}: QueueSectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: queueKey,
    disabled: isReadOnly,
  })

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>{title}</span>
        <Chip>{items.length}</Chip>
        {dateRangeLabel != null && (
          <span className="ml-auto">{dateRangeLabel}</span>
        )}
      </div>

      <div ref={setNodeRef} className={cn('py-1', isOver && 'bg-muted')}>
        <SortableContext
          items={items.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            items.map((task) =>
              isReadOnly ? (
                <div key={task.id} className="border-b border-border">
                  <TaskRowAppearance
                    task={task}
                    secondLineExtras={getTaskRowTimeBlockExtras(
                      taskRowStates?.get(task.id),
                    )}
                    isCurrentTimeBlock={
                      taskRowStates?.get(task.id)?.isCurrentTimeBlock ?? false
                    }
                  />
                </div>
              ) : (
                <QueueItemRow
                  key={task.id}
                  task={task}
                  queueKey={queueKey}
                  {...(queueDate == null ? {} : { queueDate })}
                  secondLineExtras={getTaskRowTimeBlockExtras(
                    taskRowStates?.get(task.id),
                  )}
                  isCurrentTimeBlock={
                    taskRowStates?.get(task.id)?.isCurrentTimeBlock ?? false
                  }
                  onRemove={() => {
                    onRemove(task.id)
                  }}
                />
              ),
            )
          )}
        </SortableContext>
      </div>
    </div>
  )
}
