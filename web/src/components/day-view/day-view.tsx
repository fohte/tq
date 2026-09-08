import { CalendarPlus, Kanban, List, Plus } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'

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
import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { TaskListHeader } from '#components/task/task-list-header'
import { ActionsMenu, type ActionsMenuItem } from '#components/ui/actions-menu'
import { Button } from '#components/ui/button'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { TabStrip } from '#components/ui/tab-strip'
import type { Schedule } from '#hooks/use-schedules'
import type { Task } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import type { QueueCandidate } from '#lib/queue-candidates'
import { cn } from '#lib/utils'

export type DayViewMode = 'queue' | 'kanban'

type MobileTab = 'calendar' | 'tasks'

const MOBILE_TAB_OPTIONS = [
  { value: 'calendar', label: 'calendar' },
  { value: 'tasks', label: 'tasks' },
] as const

interface SelectedRange {
  start: Date
  end: Date
}

// A plain click (no drag) reports a range as short as one snap increment —
// treat anything under 30 minutes as "just a click" and default to 30.
export function estimateMinutesForRange(range: SelectedRange): number {
  const rawMinutes = Math.round(
    (range.end.getTime() - range.start.getTime()) / 60_000,
  )
  return Math.max(30, rawMinutes)
}

export interface DayViewPresentationProps {
  isLoading: boolean
  calendarEvents: TimeBlockEvent[]
  schedules: Schedule[]
  dndCallbacks?: CalendarDndCallbacks
  onCreateTimeBlock: (input: {
    taskId: string
    startTime: string
    endTime: string
  }) => void
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
  onVisibleRangeChange?: (range: { start: Date; end: Date }) => void
  viewMode: DayViewMode
  onViewModeChange: (mode: DayViewMode) => void
}

export function DayViewPresentation({
  isLoading,
  calendarEvents,
  schedules,
  dndCallbacks,
  onCreateTimeBlock,
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
  onVisibleRangeChange,
  viewMode,
  onViewModeChange,
}: DayViewPresentationProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('calendar')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<SelectedRange | null>(null)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>(
    undefined,
  )

  const openCreateModal = useCallback((range: SelectedRange | null) => {
    setPendingRange(range)
    setIsCreateModalOpen(true)
  }, [])
  const taskListRef = useRef<HTMLDivElement>(null)

  const canAutoAssign = dayQueueTasks.some((t) => t.estimatedMinutes != null)

  const layoutItems: ActionsMenuItem[] = [
    {
      icon: <List className="h-4 w-4" />,
      label: 'List',
      onClick: () => {
        onViewModeChange('queue')
      },
      selected: viewMode === 'queue',
    },
    {
      icon: <Kanban className="h-4 w-4" />,
      label: 'Board',
      onClick: () => {
        onViewModeChange('kanban')
      },
      selected: viewMode === 'kanban',
    },
  ]
  // On mobile the calendar pane has no layout to switch (list/board only
  // affect the queue pane), so the item would be a no-op there — desktop
  // always shows both panes, so it always keeps the entry.
  const mobileLayoutItems = mobileTab === 'calendar' ? [] : layoutItems

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
      <ScreenHeaderBar>
        <SectionHeading level={2}>queue</SectionHeading>

        <TabStrip
          value={mobileTab}
          options={MOBILE_TAB_OPTIONS}
          onChange={setMobileTab}
          className="md:hidden [&>button]:px-1.5"
        />

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
            openCreateModal(null)
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

        <ActionsMenu
          aria-label="Layout"
          items={layoutItems}
          mobileItems={mobileLayoutItems}
        />
      </ScreenHeaderBar>

      <CreateScheduleModal
        key={editingSchedule?.scheduleId ?? 'new'}
        open={isScheduleModalOpen}
        onOpenChange={setIsScheduleModalOpen}
        schedule={editingSchedule}
      />

      <CreateTaskModal
        key={`task-modal-${pendingRange ? pendingRange.start.toISOString() : 'new'}`}
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        defaultStartDate={formatLocalDate(pendingRange?.start ?? new Date())}
        {...(pendingRange
          ? { defaultEstimateMinutes: estimateMinutesForRange(pendingRange) }
          : {})}
        onCreated={(task) => {
          if (!pendingRange) return
          onCreateTimeBlock({
            taskId: task.id,
            startTime: pendingRange.start.toISOString(),
            endTime: pendingRange.end.toISOString(),
          })
        }}
      />

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
          {/* Summary header (today's queue only) */}
          <div className="border-b border-border py-2.5">
            <TaskListHeader tasks={dayQueueTasks} />
          </div>

          {viewMode === 'kanban' ? (
            <div className="min-h-0 flex-1">
              <TaskKanban
                columns={kanbanColumns}
                onDrop={handleKanbanDrop}
                onReorder={onReorderQueue}
                candidates={queueCandidates}
                onAddCandidate={onAddCandidate}
                onInsertCandidate={onInsertCandidate}
              />
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
              onVisibleRangeChange={onVisibleRangeChange}
              onScheduleClick={handleScheduleClick}
              onSelectRange={openCreateModal}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
