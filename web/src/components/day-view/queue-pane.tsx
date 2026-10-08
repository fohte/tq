import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

import { findWritableQueueSection } from '#components/day-view/queue-sections'
import { QueueCandidatesSection } from '#components/task/queue-candidates-section'
import type { QueueTaskDragData } from '#components/task/queue-item-row'
import { QueueSection } from '#components/task/queue-section'
import type { TaskRowTimeBlockState } from '#components/task/task-row-time-block'
import type { Task } from '#hooks/use-tasks'
import { NoDndMouseSensor, NoDndTouchSensor } from '#lib/dnd-sensors'
import { isCandidateDragData, type QueueCandidate } from '#lib/queue-candidates'
import { cn } from '#lib/utils'

export interface QueueSectionData {
  key: string
  title: string
  items: Task[]
  dayGroups?: {
    date: string
    label: string
    items: Task[]
  }[]
  /** e.g. "09-01" for a day queue or "08-31 – 09-06" for a week queue; omit for a queue with no periodUnit. */
  dateRangeLabel?: string
  isReadOnly?: boolean
  emptyMessage: string
}

function isQueueTaskDragData(
  data: Record<string, unknown> | undefined,
): data is QueueTaskDragData {
  return data?.['type'] === 'queue-task'
}

export interface QueuePaneProps {
  isLoading: boolean
  queueSections: QueueSectionData[]
  queueDate: string
  queueCandidates: QueueCandidate<Task>[]
  onMoveTask: (taskId: string, fromQueueKey: string, toQueueKey: string) => void
  onInsertCandidate: (queueKey: string, taskId: string) => void
  onRemoveFromQueue: (queueKey: string, taskId: string) => void
  onMoveScheduledTaskToWeek: (taskId: string, date: string) => void
  taskRowStates?: ReadonlyMap<string, TaskRowTimeBlockState>
  className?: string
}

export function QueuePane({
  isLoading,
  queueSections,
  queueDate,
  queueCandidates,
  onMoveTask,
  onInsertCandidate,
  onRemoveFromQueue,
  onMoveScheduledTaskToWeek,
  taskRowStates,
  className,
}: QueuePaneProps) {
  // Delayed touch activation keeps scrolling available and lets short taps navigate.
  const dndSensors = useSensors(
    useSensor(NoDndMouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(NoDndTouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over == null) return
    const overId = String(over.id)
    const targetSection = findWritableQueueSection(queueSections, overId)
    if (targetSection == null) return

    const activeData = active.data.current
    if (isCandidateDragData(activeData)) {
      onInsertCandidate(targetSection.key, activeData.taskId)
      return
    }

    if (isQueueTaskDragData(activeData)) {
      const sourceKey = activeData.queueKey
      if (targetSection.key !== sourceKey) {
        onMoveTask(String(active.id), sourceKey, targetSection.key)
      }
    }
  }

  return (
    <div
      className={cn('flex-1 overflow-auto', className)}
      data-scroll-restoration-id="day-view"
    >
      {isLoading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : (
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {queueSections.map((section) => (
            <QueueSection
              key={section.key}
              queueKey={section.key}
              queueDate={queueDate}
              title={section.title}
              items={section.items}
              {...(section.dayGroups == null
                ? {}
                : { dayGroups: section.dayGroups })}
              {...(taskRowStates == null ? {} : { taskRowStates })}
              {...(section.dateRangeLabel != null
                ? { dateRangeLabel: section.dateRangeLabel }
                : {})}
              {...(section.isReadOnly === true ? { isReadOnly: true } : {})}
              emptyMessage={section.emptyMessage}
              onMoveScheduledTaskToWeek={onMoveScheduledTaskToWeek}
              onRemove={(taskId) => {
                onRemoveFromQueue(section.key, taskId)
              }}
            />
          ))}

          <QueueCandidatesSection candidates={queueCandidates} />
        </DndContext>
      )}
    </div>
  )
}
