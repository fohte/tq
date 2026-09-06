import { CalendarPlus, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import {
  CalendarView,
  type TimeBlockEvent,
} from '#components/calendar/calendar-view'
import {
  QueuePane,
  type QueueSectionData,
} from '#components/day-view/queue-pane'
import {
  TaskKanban,
  type TaskKanbanColumn,
} from '#components/kanban/task-kanban'
import type { DayViewMode } from '#components/layout/view-mode-toggle'
import { ViewModeToggle } from '#components/layout/view-mode-toggle'
import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { TaskListHeader } from '#components/task/task-list-header'
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

export interface DayViewPresentationProps {
  isLoading: boolean
  calendarEvents: TimeBlockEvent[]
  schedules: Schedule[]
  dndCallbacks?: CalendarDndCallbacks
  /** Google OAuth consent URL, present when Google Calendar is not connected */
  gcalAuthUrl?: string
  queueSections: QueueSectionData[]
  /** The day queue's own (unfiltered — completed tasks included) items, for
   * the progress bar and auto-assign eligibility, which only ever apply to
   * "today" regardless of how many other queues exist. */
  dayQueueTasks: Task[]
  queueCandidates: QueueCandidate<Task>[]
  onReorderQueue: (queueKey: string, taskIds: string[]) => void
  onMoveTask: (taskId: string, fromQueueKey: string, toQueueKey: string) => void
  onInsertCandidate: (queueKey: string, taskId: string, index: number) => void
  /** The candidates section's "+" button always adds to the day queue —
   * dragging a candidate onto a different section goes through
   * onInsertCandidate instead. */
  onAddCandidate: (taskId: string) => void
  onRemoveFromQueue: (queueKey: string, taskId: string) => void
  onAutoAssign: () => void
  isAutoAssigning: boolean
  selectedDate: Date
  onDateChange: (date: Date) => void
  viewMode: DayViewMode
  onViewModeChange: (mode: DayViewMode) => void
}

export function DayViewPresentation({
  isLoading,
  calendarEvents,
  schedules,
  dndCallbacks,
  gcalAuthUrl,
  queueSections,
  dayQueueTasks,
  queueCandidates,
  onReorderQueue,
  onMoveTask,
  onInsertCandidate,
  onAddCandidate,
  onRemoveFromQueue,
  onAutoAssign,
  isAutoAssigning,
  selectedDate,
  onDateChange,
  viewMode,
  onViewModeChange,
}: DayViewPresentationProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('calendar')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>(
    undefined,
  )
  const taskListRef = useRef<HTMLDivElement>(null)

  const canAutoAssign = dayQueueTasks.some((t) => t.estimatedMinutes != null)

  const kanbanColumns: TaskKanbanColumn[] = useMemo(
    () =>
      queueSections.map((section) => ({
        id: section.key,
        title: section.title,
        tasks: section.items,
        isLoading,
        ...(section.dateRangeLabel != null
          ? { dateRangeLabel: section.dateRangeLabel }
          : {}),
      })),
    [queueSections, isLoading],
  )

  const handleKanbanDrop = (taskId: string, targetQueueKey: string) => {
    const sourceQueueKey = queueSections.find((section) =>
      section.items.some((t) => t.id === taskId),
    )?.key
    if (sourceQueueKey == null) return
    onMoveTask(taskId, sourceQueueKey, targetQueueKey)
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
    // Day view keeps its own internal scroll pane rather than scrolling the
    // document — its time-grid layout stays pinned to one viewport, like a
    // native calendar. AppLayout gives <main> min-h-0 specifically for this
    // route (see app-layout.tsx) so h-full here resolves to main's actual
    // flex-allotted share of the viewport instead of overflowing it.
    <div className="flex h-full flex-col overflow-hidden">
      {/* Mobile pane switcher */}
      <div className="border-b border-border px-3 py-2 md:hidden">
        <TabStrip
          value={mobileTab}
          options={MOBILE_TAB_OPTIONS}
          onChange={setMobileTab}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left panel: queue */}
        <div
          ref={taskListRef}
          className={cn(
            'flex w-full flex-col',
            viewMode === 'kanban'
              ? 'md:w-full'
              : 'border-r border-border md:w-80 lg:w-96',
            mobileTab === 'calendar' ? 'hidden md:flex' : 'flex md:flex',
          )}
        >
          <ScreenHeaderBar>
            <SectionHeading level={2}>queue</SectionHeading>

            <ViewModeToggle value={viewMode} onChange={onViewModeChange} />

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

          {/* Summary header (today's queue only) */}
          <div className="border-b border-border py-2.5">
            <TaskListHeader tasks={dayQueueTasks} />
          </div>

          {viewMode === 'kanban' ? (
            <div className="min-h-0 flex-1">
              <TaskKanban columns={kanbanColumns} onDrop={handleKanbanDrop} />
            </div>
          ) : (
            <QueuePane
              isLoading={isLoading}
              queueSections={queueSections}
              queueCandidates={queueCandidates}
              onReorderQueue={onReorderQueue}
              onMoveTask={onMoveTask}
              onInsertCandidate={onInsertCandidate}
              onAddCandidate={onAddCandidate}
              onRemoveFromQueue={onRemoveFromQueue}
            />
          )}
        </div>

        {/* Right panel: Calendar */}
        <div
          className={cn(
            'flex-1',
            mobileTab === 'tasks' ? 'hidden' : 'flex',
            viewMode === 'kanban' ? 'md:hidden' : 'md:flex',
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
