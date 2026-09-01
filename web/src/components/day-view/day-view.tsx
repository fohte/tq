import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CalendarPlus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import {
  CalendarView,
  type TimeBlockEvent,
} from '#components/calendar/calendar-view'
import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { QueueCandidatesSection } from '#components/task/queue-candidates-section'
import { TaskListHeader } from '#components/task/task-list-header'
import { TodayQueueRow } from '#components/task/today-queue-row'
import { Button } from '#components/ui/button'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { TabStrip } from '#components/ui/tab-strip'
import type { Schedule } from '#hooks/use-schedules'
import type { Task } from '#hooks/use-tasks'
import type { QueueCandidate } from '#lib/queue-candidates'
import { cn } from '#lib/utils'

type MobileTab = 'calendar' | 'tasks'

const MOBILE_TAB_OPTIONS = [
  { value: 'calendar', label: 'calendar' },
  { value: 'tasks', label: 'queue' },
] as const

interface CandidateDragData extends Record<string, unknown> {
  type: 'candidate'
  taskId: string
}

function isCandidateDragData(
  data: Record<string, unknown> | undefined,
): data is CandidateDragData {
  return data?.['type'] === 'candidate'
}

function EmptyQueueDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'empty-queue' })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'p-4 text-center text-sm text-muted-foreground',
        isOver && 'bg-muted',
      )}
    >
      No tasks in today's queue
    </div>
  )
}

export interface DayViewPresentationProps {
  isLoading: boolean
  calendarEvents: TimeBlockEvent[]
  schedules: Schedule[]
  dndCallbacks?: CalendarDndCallbacks
  /** Google OAuth consent URL, present when Google Calendar is not connected */
  gcalAuthUrl?: string
  queueTasks: Task[]
  queueCandidates: QueueCandidate<Task>[]
  onReorderQueue: (taskIds: string[]) => void
  onInsertCandidate: (taskId: string, index: number) => void
  onToggleQueueTask: (taskId: string) => void
  onRemoveFromQueue: (taskId: string) => void
  onAutoAssign: () => void
  isAutoAssigning: boolean
  selectedDate: Date
  onDateChange: (date: Date) => void
}

export function DayViewPresentation({
  isLoading,
  calendarEvents,
  schedules,
  dndCallbacks,
  gcalAuthUrl,
  queueTasks,
  queueCandidates,
  onReorderQueue,
  onInsertCandidate,
  onToggleQueueTask,
  onRemoveFromQueue,
  onAutoAssign,
  isAutoAssigning,
  selectedDate,
  onDateChange,
}: DayViewPresentationProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('calendar')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>(
    undefined,
  )
  const taskListRef = useRef<HTMLDivElement>(null)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const canAutoAssign = queueTasks.some((t) => t.estimatedMinutes != null)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over == null) return

    const activeData = active.data.current
    if (isCandidateDragData(activeData)) {
      const overIndex = queueTasks.findIndex((t) => t.id === over.id)
      if (overIndex === -1) {
        onInsertCandidate(activeData.taskId, queueTasks.length)
        return
      }
      const activeTop = active.rect.current.translated?.top ?? over.rect.top
      const isAfter = activeTop > over.rect.top + over.rect.height / 2
      onInsertCandidate(activeData.taskId, overIndex + (isAfter ? 1 : 0))
      return
    }

    if (active.id === over.id) return
    const oldIndex = queueTasks.findIndex((t) => t.id === active.id)
    const newIndex = queueTasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderQueue(arrayMove(queueTasks, oldIndex, newIndex).map((t) => t.id))
  }

  const handleScheduleClick = (scheduleId: string, start: string) => {
    // Cross-midnight schedules expand into two blocks sharing a scheduleId
    // (see expandScheduleForDate) — match on start too so the clicked block
    // resolves to itself, not whichever block happens to sort first.
    const schedule = schedules.find(
      (s) => s.scheduleId === scheduleId && s.start === start,
    )
    if (!schedule) return
    setEditingSchedule(schedule)
    setIsScheduleModalOpen(true)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Mobile pane switcher */}
      <div className="border-b border-border px-3 py-2 md:hidden">
        <TabStrip
          value={mobileTab}
          options={MOBILE_TAB_OPTIONS}
          onChange={setMobileTab}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left panel: Today's Queue */}
        <div
          ref={taskListRef}
          className={cn(
            'flex w-full flex-col border-r border-border md:w-80 lg:w-96',
            mobileTab === 'calendar' ? 'hidden md:flex' : 'flex md:flex',
          )}
        >
          <ScreenHeaderBar>
            <SectionHeading level={2}>queue</SectionHeading>

            <Button
              variant="outline"
              size="xs"
              onClick={onAutoAssign}
              disabled={isAutoAssigning || !canAutoAssign}
              title={
                canAutoAssign
                  ? undefined
                  : 'Set an estimate on at least one queued task to auto-schedule'
              }
              className="ml-auto"
            >
              {isAutoAssigning ? 'scheduling…' : 'auto'}
            </Button>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setIsCreateModalOpen(true)
              }}
              aria-label="New task"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setEditingSchedule(undefined)
                setIsScheduleModalOpen(true)
              }}
              aria-label="New schedule"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
            </Button>
          </ScreenHeaderBar>

          <CreateScheduleModal
            key={editingSchedule?.scheduleId ?? 'new'}
            open={isScheduleModalOpen}
            onOpenChange={setIsScheduleModalOpen}
            schedule={editingSchedule}
          />

          <CreateTaskModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            defaultStartDate={new Date().toISOString().slice(0, 10)}
          />

          {/* Summary header */}
          <div className="border-b border-border py-2.5">
            <TaskListHeader tasks={queueTasks} />
          </div>

          {/* Task list */}
          <div
            className="flex-1 overflow-auto"
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
                <SortableContext
                  items={queueTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="py-1">
                    {queueTasks.length === 0 ? (
                      <EmptyQueueDropZone />
                    ) : (
                      queueTasks.map((task) => (
                        <TodayQueueRow
                          key={task.id}
                          task={task}
                          onRemove={() => {
                            onRemoveFromQueue(task.id)
                          }}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>

                <QueueCandidatesSection
                  candidates={queueCandidates}
                  onAdd={onToggleQueueTask}
                />
              </DndContext>
            )}
          </div>
        </div>

        {/* Right panel: Calendar */}
        <div
          className={cn(
            'flex-1',
            mobileTab === 'tasks' ? 'hidden md:flex' : 'flex md:flex',
          )}
        >
          <div className="flex h-full w-full flex-col">
            {gcalAuthUrl != null && (
              <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Google Calendar が連携されていません
                </span>
                <a
                  href={gcalAuthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  連携する
                </a>
              </div>
            )}
            <CalendarView
              events={calendarEvents}
              dndCallbacks={dndCallbacks}
              externalDragContainerRef={taskListRef}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              onScheduleClick={handleScheduleClick}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
