import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import {
  CalendarView,
  type TimeBlockEvent,
} from '#components/calendar/calendar-view'
import { BacklogPreview } from '#components/task/backlog-preview'
import { CreateTaskInline } from '#components/task/create-task-inline'
import { QueueCandidatesSection } from '#components/task/queue-candidates-section'
import { TaskListHeader } from '#components/task/task-list-header'
import { TodayQueueRow } from '#components/task/today-queue-row'
import { Button } from '#components/ui/button'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { TabStrip } from '#components/ui/tab-strip'
import type { Task } from '#hooks/use-tasks'
import type { QueueCandidate } from '#lib/queue-candidates'
import { cn } from '#lib/utils'

type MobileTab = 'calendar' | 'tasks'

const MOBILE_TAB_OPTIONS = [
  { value: 'calendar', label: 'calendar' },
  { value: 'tasks', label: 'queue' },
] as const

export interface DayViewPresentationProps {
  isLoading: boolean
  backlogTasks: Task[]
  calendarEvents: TimeBlockEvent[]
  dndCallbacks?: CalendarDndCallbacks
  /** Google OAuth consent URL, present when Google Calendar is not connected */
  gcalAuthUrl?: string
  queueTasks: Task[]
  queueCandidates: QueueCandidate<Task>[]
  onReorderQueue: (taskIds: string[]) => void
  onToggleQueueTask: (taskId: string) => void
  onRemoveFromQueue: (taskId: string) => void
  onAutoAssign: () => void
  isAutoAssigning: boolean
  selectedDate: Date
  onDateChange: (date: Date) => void
}

export function DayViewPresentation({
  isLoading,
  backlogTasks,
  calendarEvents,
  dndCallbacks,
  gcalAuthUrl,
  queueTasks,
  queueCandidates,
  onReorderQueue,
  onToggleQueueTask,
  onRemoveFromQueue,
  onAutoAssign,
  isAutoAssigning,
  selectedDate,
  onDateChange,
}: DayViewPresentationProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('calendar')
  const [isCreating, setIsCreating] = useState(false)
  const taskListRef = useRef<HTMLDivElement>(null)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const canAutoAssign = queueTasks.some((t) => t.estimatedMinutes != null)

  const handleQueueDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over == null || active.id === over.id) return
    const oldIndex = queueTasks.findIndex((t) => t.id === active.id)
    const newIndex = queueTasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderQueue(arrayMove(queueTasks, oldIndex, newIndex).map((t) => t.id))
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
                setIsCreating(true)
              }}
              aria-label="New task"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </ScreenHeaderBar>

          {/* Summary header */}
          <div className="border-b border-border py-2.5">
            <TaskListHeader tasks={queueTasks} />
          </div>

          {/* Inline create */}
          {isCreating && (
            <div className="border-b border-border">
              <CreateTaskInline
                onClose={() => {
                  setIsCreating(false)
                }}
                defaultStartDate={new Date().toISOString().slice(0, 10)}
              />
            </div>
          )}

          {/* Task list */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                {queueTasks.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No tasks in today's queue
                  </div>
                ) : (
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleQueueDragEnd}
                  >
                    <SortableContext
                      items={queueTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="py-1">
                        {queueTasks.map((task) => (
                          <TodayQueueRow
                            key={task.id}
                            task={task}
                            onRemove={() => {
                              onRemoveFromQueue(task.id)
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                <QueueCandidatesSection
                  candidates={queueCandidates}
                  onAdd={onToggleQueueTask}
                />
              </>
            )}
          </div>

          <BacklogPreview tasks={backlogTasks} />
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
            />
          </div>
        </div>
      </div>
    </div>
  )
}
