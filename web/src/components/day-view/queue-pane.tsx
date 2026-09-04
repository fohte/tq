import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import { QueueCandidatesSection } from '#components/task/queue-candidates-section'
import type { QueueTaskDragData } from '#components/task/queue-item-row'
import { QueueSection } from '#components/task/queue-section'
import type { Task } from '#hooks/use-tasks'
import type { QueueCandidate } from '#lib/queue-candidates'

export interface QueueSectionData {
  key: string
  title: string
  items: Task[]
  /** e.g. "09-01" for a day queue or "08-31 – 09-06" for a week queue; omit for a queue with no periodUnit. */
  dateRangeLabel?: string
  emptyMessage: string
}

interface CandidateDragData extends Record<string, unknown> {
  type: 'candidate'
  taskId: string
}

function isCandidateDragData(
  data: Record<string, unknown> | undefined,
): data is CandidateDragData {
  return data?.['type'] === 'candidate'
}

function isQueueTaskDragData(
  data: Record<string, unknown> | undefined,
): data is QueueTaskDragData {
  return data?.['type'] === 'queue-task'
}

// `over.id` is either a section's own droppable id (dropped on empty space
// within it) or one of its item ids (dropped on/near a row) — either way,
// this finds which section the drag ended over.
function findTargetSection(
  sections: QueueSectionData[],
  overId: string,
): QueueSectionData | undefined {
  return (
    sections.find((s) => s.key === overId) ??
    sections.find((s) => s.items.some((t) => t.id === overId))
  )
}

export interface QueuePaneProps {
  isLoading: boolean
  queueSections: QueueSectionData[]
  queueCandidates: QueueCandidate<Task>[]
  onReorderQueue: (queueKey: string, taskIds: string[]) => void
  onMoveTask: (taskId: string, fromQueueKey: string, toQueueKey: string) => void
  onInsertCandidate: (queueKey: string, taskId: string, index: number) => void
  onAddCandidate: (taskId: string) => void
  onRemoveFromQueue: (queueKey: string, taskId: string) => void
}

export function QueuePane({
  isLoading,
  queueSections,
  queueCandidates,
  onReorderQueue,
  onMoveTask,
  onInsertCandidate,
  onAddCandidate,
  onRemoveFromQueue,
}: QueuePaneProps) {
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over == null) return
    const overId = String(over.id)
    const targetSection = findTargetSection(queueSections, overId)
    if (targetSection == null) return

    const activeData = active.data.current
    if (isCandidateDragData(activeData)) {
      const overIndex = targetSection.items.findIndex((t) => t.id === overId)
      if (overIndex === -1) {
        onInsertCandidate(
          targetSection.key,
          activeData.taskId,
          targetSection.items.length,
        )
        return
      }
      const activeTop = active.rect.current.translated?.top ?? over.rect.top
      const isAfter = activeTop > over.rect.top + over.rect.height / 2
      onInsertCandidate(
        targetSection.key,
        activeData.taskId,
        overIndex + (isAfter ? 1 : 0),
      )
      return
    }

    if (isQueueTaskDragData(activeData)) {
      const sourceKey = activeData.queueKey
      if (targetSection.key !== sourceKey) {
        onMoveTask(String(active.id), sourceKey, targetSection.key)
        return
      }

      if (active.id === over.id) return
      const oldIndex = targetSection.items.findIndex((t) => t.id === active.id)
      const newIndex = targetSection.items.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      onReorderQueue(
        sourceKey,
        arrayMove(targetSection.items, oldIndex, newIndex).map((t) => t.id),
      )
    }
  }

  return (
    <div className="flex-1 overflow-auto" data-scroll-restoration-id="day-view">
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
              title={section.title}
              items={section.items}
              {...(section.dateRangeLabel != null
                ? { dateRangeLabel: section.dateRangeLabel }
                : {})}
              emptyMessage={section.emptyMessage}
              onRemove={(taskId) => {
                onRemoveFromQueue(section.key, taskId)
              }}
            />
          ))}

          <QueueCandidatesSection
            candidates={queueCandidates}
            onAdd={onAddCandidate}
          />
        </DndContext>
      )}
    </div>
  )
}
