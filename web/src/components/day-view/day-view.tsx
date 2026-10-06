import { Button } from '@fohte/ui/button'
import { SegmentedControl } from '@fohte/ui/segmented-control'
import { useNavigate } from '@tanstack/react-router'
import { CalendarPlus, Kanban, List, Plus } from 'lucide-react'
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import {
  CalendarView,
  type TimeBlockEvent,
} from '#components/calendar/calendar-view'
import { CompactMemoPanel } from '#components/day-view/compact-memo-panel'
import { NowPanel, type NowPanelProps } from '#components/day-view/now-panel'
import {
  QueuePane,
  type QueueSectionData,
} from '#components/day-view/queue-pane'
import { DUE_TODAY_SECTION_KEY } from '#components/day-view/queue-sections'
import {
  TaskKanban,
  type TaskKanbanColumn,
} from '#components/kanban/task-kanban'
import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { TaskListHeader } from '#components/task/task-list-header'
import type { TaskRowTimeBlockState } from '#components/task/task-row-time-block'
import { ActionsMenu, type ActionsMenuItem } from '#components/ui/actions-menu'
import { ResizablePaneSeparator } from '#components/ui/resizable-pane-separator'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import type { Memo, MemoContext, SaveMemoInput } from '#hooks/use-memos'
import { DAY_QUEUE_KEY } from '#hooks/use-queues'
import { useResizableWidth } from '#hooks/use-resizable-width'
import type { Schedule } from '#hooks/use-schedules'
import type { Task } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import type { QueueCandidate } from '#lib/queue-candidates'
import {
  getQueueMaxWidth,
  QUEUE_DEFAULT_WIDTH,
  QUEUE_MAX_WIDTH,
  QUEUE_MIN_WIDTH,
  QUEUE_WIDE_DEFAULT_WIDTH,
} from '#lib/resizable-pane-width'
import { cn } from '#lib/utils'

export type DayViewMode = 'queue' | 'kanban'

type MobileTab = 'calendar' | 'tasks'

interface QueuePaneStyle extends CSSProperties {
  '--queue-width': string
}

const MOBILE_TAB_OPTIONS = [
  { value: 'calendar', label: 'calendar' },
  { value: 'tasks', label: 'tasks' },
] as const
const QUEUE_WIDTH_STORAGE_KEY = 'tq:day-view-queue-width'

interface SelectedRange {
  start: Date
  end: Date
}

// A plain click (no drag) reports a range as short as one snap increment —
// treat anything under 30 minutes as "just a click" and default to 30.
function estimateMinutesForRange(range: SelectedRange): number {
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
   * the progress bar, which only ever applies to "today" regardless of how
   * many other queues exist. */
  dayQueueTasks: Task[]
  queueCandidates: QueueCandidate<Task>[]
  onMoveTask: (taskId: string, fromQueueKey: string, toQueueKey: string) => void
  onInsertCandidate: (queueKey: string, taskId: string) => void
  /** The kanban candidates' "+" button always adds to the day queue —
   * dragging a candidate onto a different section goes through
   * onInsertCandidate instead. */
  onAddCandidate: (taskId: string) => void
  onRemoveFromQueue: (queueKey: string, taskId: string) => void
  selectedDate: Date
  onDateChange: (date: Date) => void
  onVisibleRangeChange?: (range: { start: Date; end: Date }) => void
  viewMode: DayViewMode
  onViewModeChange: (mode: DayViewMode) => void
  kanbanFilterRow?: ReactNode
  /** Mounts with the mobile calendar/tasks pane switcher already on this tab. */
  initialMobileTab?: MobileTab
  layout?: 'default' | 'compact'
  nowPanel?: NowPanelProps
  taskRowStates?: ReadonlyMap<string, TaskRowTimeBlockState>
  compactMemo?:
    | {
        context: MemoContext
        memo: Memo | undefined
        isLoading: boolean
        loadError: boolean
        onSave: (input: SaveMemoInput) => Promise<Memo>
      }
    | undefined
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
  onMoveTask,
  onInsertCandidate,
  onAddCandidate,
  onRemoveFromQueue,
  selectedDate,
  onDateChange,
  onVisibleRangeChange,
  viewMode,
  onViewModeChange,
  kanbanFilterRow,
  initialMobileTab,
  layout = 'default',
  nowPanel,
  taskRowStates,
  compactMemo,
}: DayViewPresentationProps) {
  const isCompactLayout = layout === 'compact'
  const activeViewMode = isCompactLayout ? 'queue' : viewMode
  const navigate = useNavigate()
  const [mobileTab, setMobileTab] = useState<MobileTab>(
    initialMobileTab ?? 'calendar',
  )
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<SelectedRange | null>(null)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>(
    undefined,
  )
  const {
    width: queueWidth,
    maxWidth: maxQueueWidth,
    onValueChange: onQueueWidthChange,
    onValueCommit: onQueueWidthCommit,
  } = useResizableWidth({
    storageKey: QUEUE_WIDTH_STORAGE_KEY,
    defaultWidth: () =>
      window.matchMedia('(min-width: 64rem)').matches
        ? QUEUE_WIDE_DEFAULT_WIDTH
        : QUEUE_DEFAULT_WIDTH,
    minWidth: QUEUE_MIN_WIDTH,
    maxWidth: QUEUE_MAX_WIDTH,
    responsiveMaxWidth: getQueueMaxWidth,
  })
  const queuePaneStyle: QueuePaneStyle = {
    '--queue-width': `${String(queueWidth)}px`,
  }

  const openCreateModal = useCallback((range: SelectedRange | null) => {
    setPendingRange(range)
    setIsCreateModalOpen(true)
  }, [])
  const taskListRef = useRef<HTMLDivElement>(null)

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
  const visibleQueueSections = isCompactLayout
    ? queueSections.filter(
        (section) =>
          section.key === DAY_QUEUE_KEY ||
          section.key === DUE_TODAY_SECTION_KEY,
      )
    : queueSections

  const kanbanColumns: TaskKanbanColumn[] = useMemo(
    () =>
      visibleQueueSections.map((section) => ({
        id: section.key,
        title: section.title,
        tasks: section.items,
        isLoading,
        ...(section.dateRangeLabel != null
          ? { dateRangeLabel: section.dateRangeLabel }
          : {}),
      })),
    [visibleQueueSections, isLoading],
  )

  const handleKanbanDrop = (taskId: string, targetQueueKey: string) => {
    const sourceQueueKey = visibleQueueSections.find((section) =>
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

  const handleTaskClick = (taskId: string) => {
    void navigate({ to: '/tasks/$taskId', params: { taskId } })
  }

  return (
    // Day view keeps its own internal scroll pane rather than scrolling the
    // document — its time-grid layout stays pinned to one viewport, like a
    // native calendar. Both AppLayout and the compact root provide a definite
    // height for h-full to resolve against.
    <div className="flex h-full flex-col overflow-hidden">
      {!isCompactLayout && (
        <ScreenHeaderBar className="gap-1.5 sm:gap-2.5">
          <SectionHeading level={2}>queue</SectionHeading>

          <div className="md:hidden">
            <SegmentedControl
              value={mobileTab}
              options={MOBILE_TAB_OPTIONS}
              onValueChange={setMobileTab}
            />
          </div>

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
      )}

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

      <div className={cn('flex min-h-0 flex-1', isCompactLayout && 'flex-col')}>
        {/* Left panel: queue */}
        <div
          ref={taskListRef}
          className={cn(
            'relative flex w-full flex-col',
            isCompactLayout
              ? 'shrink-0 overflow-auto border-b border-border'
              : 'md:flex-none',
            !isCompactLayout &&
              (activeViewMode === 'kanban'
                ? 'md:w-full'
                : 'border-r border-border md:w-(--queue-width)'),
            !isCompactLayout &&
              (mobileTab === 'calendar' ? 'hidden md:flex' : 'flex md:flex'),
          )}
          style={{
            ...queuePaneStyle,
            ...(isCompactLayout ? { maxHeight: '40%' } : {}),
          }}
        >
          {activeViewMode === 'kanban' && kanbanFilterRow}

          {isCompactLayout && nowPanel != null && <NowPanel {...nowPanel} />}

          {/* Summary header (today's queue only) */}
          <div className="border-b border-border py-2.5">
            <TaskListHeader tasks={dayQueueTasks} />
          </div>

          {activeViewMode === 'kanban' ? (
            <div className="min-h-0 flex-1">
              <TaskKanban
                columns={kanbanColumns}
                onDrop={handleKanbanDrop}
                candidates={queueCandidates}
                onAddCandidate={onAddCandidate}
                onInsertCandidate={onInsertCandidate}
              />
            </div>
          ) : (
            <QueuePane
              isLoading={isLoading}
              queueSections={visibleQueueSections}
              queueDate={formatLocalDate(selectedDate)}
              queueCandidates={isCompactLayout ? [] : queueCandidates}
              onMoveTask={onMoveTask}
              onInsertCandidate={onInsertCandidate}
              onRemoveFromQueue={onRemoveFromQueue}
              {...(isCompactLayout && taskRowStates != null
                ? { taskRowStates }
                : {})}
              {...(isCompactLayout
                ? { className: 'flex-none overflow-visible' }
                : {})}
            />
          )}
          {!isCompactLayout && activeViewMode === 'queue' && (
            <ResizablePaneSeparator
              label="Resize queue pane"
              value={queueWidth}
              min={QUEUE_MIN_WIDTH}
              max={maxQueueWidth}
              onValueChange={onQueueWidthChange}
              onValueCommit={onQueueWidthCommit}
            />
          )}
        </div>

        {/* Right panel: Calendar */}
        <div
          className={cn(
            'min-w-0 flex-1',
            isCompactLayout
              ? 'min-h-0 flex'
              : mobileTab === 'tasks'
                ? 'hidden'
                : 'flex',
            !isCompactLayout &&
              (activeViewMode === 'kanban' ? 'md:hidden' : 'md:flex'),
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
              showViewSwitcher={!isCompactLayout}
              onScheduleClick={handleScheduleClick}
              onTaskClick={handleTaskClick}
              onSelectRange={openCreateModal}
            />
          </div>
        </div>
      </div>

      {isCompactLayout && compactMemo != null && (
        <CompactMemoPanel
          key={compactMemo.context}
          context={compactMemo.context}
          memo={compactMemo.memo}
          isLoading={compactMemo.isLoading}
          loadError={compactMemo.loadError}
          onSave={compactMemo.onSave}
        />
      )}
    </div>
  )
}
