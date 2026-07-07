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
import type { CalendarDndCallbacks } from '@web/components/calendar/calendar-grid'
import {
  CalendarView,
  type TimeBlockEvent,
} from '@web/components/calendar/calendar-view'
import { BacklogPreview } from '@web/components/task/backlog-preview'
import { CreateTaskInline } from '@web/components/task/create-task-inline'
import { TaskListHeader } from '@web/components/task/task-list-header'
import { TaskRow } from '@web/components/task/task-row'
import { TodayQueueRow } from '@web/components/task/today-queue-row'
import { TodayQueueToggle } from '@web/components/task/today-queue-toggle'
import type { CategorizedTasks, Task } from '@web/hooks/use-tasks'
import { cn } from '@web/lib/utils'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'

type TaskTab = 'today' | 'all'
type MobileTab = 'calendar' | 'tasks'

const MOBILE_TABS = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'tasks', label: 'Tasks' },
] as const

export interface DayViewPresentationProps {
  isLoading: boolean
  categorized: CategorizedTasks
  calendarEvents: TimeBlockEvent[]
  dndCallbacks?: CalendarDndCallbacks
  /** Google OAuth consent URL, present when Google Calendar is not connected */
  gcalAuthUrl?: string
  queueTasks: Task[]
  queueTaskIds: Set<string>
  onReorderQueue: (taskIds: string[]) => void
  onToggleQueueTask: (taskId: string) => void
  onRemoveFromQueue: (taskId: string) => void
  onAutoAssign: () => void
  isAutoAssigning: boolean
}

export function DayViewPresentation({
  isLoading,
  categorized,
  calendarEvents,
  dndCallbacks,
  gcalAuthUrl,
  queueTasks,
  queueTaskIds,
  onReorderQueue,
  onToggleQueueTask,
  onRemoveFromQueue,
  onAutoAssign,
  isAutoAssigning,
}: DayViewPresentationProps) {
  const [activeTab, setActiveTab] = useState<TaskTab>('today')
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
    <div className="flex h-full">
      {/* Left panel: Today's Queue */}
      <div
        ref={taskListRef}
        className={cn(
          'flex w-full flex-col border-r border-border md:w-80 lg:w-96',
          mobileTab === 'calendar' ? 'hidden md:flex' : 'flex md:flex',
        )}
      >
        {/* Tab bar */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex gap-1">
            {(['today', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab)
                }}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'today' ? 'Today' : 'All'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'today' && (
              <button
                type="button"
                onClick={onAutoAssign}
                disabled={isAutoAssigning || !canAutoAssign}
                title={
                  canAutoAssign
                    ? undefined
                    : 'Set an estimate on at least one queued task to auto-schedule'
                }
                className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isAutoAssigning ? 'Scheduling…' : 'Auto Schedule'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsCreating(true)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary header */}
        {activeTab === 'today' && (
          <div className="py-2">
            <TaskListHeader tasks={queueTasks} />
          </div>
        )}

        {/* Inline create */}
        {isCreating && (
          <div className="border-b border-border">
            <CreateTaskInline
              onClose={() => {
                setIsCreating(false)
              }}
              {...(activeTab === 'today'
                ? { defaultStartDate: new Date().toISOString().slice(0, 10) }
                : {})}
            />
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : activeTab === 'today' ? (
            queueTasks.length === 0 ? (
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
            )
          ) : categorized.all.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No tasks yet
            </div>
          ) : (
            <div className="py-1">
              {categorized.all.map((task) => (
                <div key={task.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <TaskRow
                      task={task}
                      draggable={task.status !== 'completed'}
                    />
                  </div>
                  <TodayQueueToggle
                    inQueue={queueTaskIds.has(task.id)}
                    onToggle={() => {
                      onToggleQueueTask(task.id)
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Backlog preview (Today tab only) */}
        {activeTab === 'today' && (
          <BacklogPreview
            tasks={categorized.backlog}
            onViewAll={() => {
              setActiveTab('all')
            }}
          />
        )}
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
          />
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="fixed bottom-16 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-lg bg-secondary p-0.5 shadow-lg md:hidden">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setMobileTab(tab.value)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mobileTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
