import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CalendarChangeFeedbackPopup } from '#components/calendar/calendar-change-feedback-popup'
import {
  type DayViewMode,
  DayViewPresentation,
} from '#components/day-view/day-view'
import { KanbanFilterRow } from '#components/day-view/kanban-filter-row'
import {
  buildCompactQueueSections,
  buildQueueSections,
} from '#components/day-view/queue-sections'
import { useCalendarChangeFeedback } from '#hooks/use-calendar-change-feedback'
import { useCompactMemoData } from '#hooks/use-compact-memo-data'
import { useCompactRefreshErrorLogging } from '#hooks/use-compact-refresh-error-logging'
import { useCurrentContext } from '#hooks/use-current-context'
import { useDayQueueCalendar } from '#hooks/use-day-queue-calendar'
import { useDayViewCalendarEvents } from '#hooks/use-day-view-calendar-events'
import { useDayViewTaskData } from '#hooks/use-day-view-task-data'
import { useBaseFilter } from '#hooks/use-filtered-tasks'
import { useFutureDayQueueItems } from '#hooks/use-future-day-queue-items'
import { GcalAuthRequiredError, useGcalEvents } from '#hooks/use-gcal-events'
import { useIntegrationAuthUrl } from '#hooks/use-integrations'
import { useNowPanelData, useNowPanelQueries } from '#hooks/use-now-panel-data'
import { ALL_PROJECTS_FILTER, useProjects } from '#hooks/use-projects'
import {
  DAY_QUEUE_KEY,
  type QueueItem,
  queueKeys,
  useQueueCarryOver,
  useQueueItemsForQueues,
  useQueues,
  useSetQueueItems,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import { useScheduleList } from '#hooks/use-schedules'
import { useSelectedDate } from '#hooks/use-selected-date'
import { useTaskList } from '#hooks/use-tasks'
import {
  useCreateTimeBlock,
  useTimeBlocks,
  useUpdateTimeBlock,
} from '#hooks/use-time-blocks'
import { isCompactDayLayoutSearch } from '#lib/compact-layout'
import { formatLocalDate, toLocalDateRange } from '#lib/date-range'
import { buildKanbanFilterQuery } from '#lib/kanban-filter-query'
import { appendQueueTaskId } from '#lib/queue-task-order'

const dayViewSearchDefaults = { view: 'queue', q: '' } as const

interface DayViewSearch {
  view?: DayViewMode
  q?: string
  layout?: 'compact'
}

function validateSearch(search: Record<string, unknown>): DayViewSearch {
  const rawQ = typeof search['q'] === 'string' ? search['q'] : undefined
  const q = rawQ == null ? undefined : buildKanbanFilterQuery(rawQ)
  return {
    view: search['view'] === 'kanban' ? 'kanban' : 'queue',
    ...(q == null || q === '' ? {} : { q }),
    ...(isCompactDayLayoutSearch(search) ? { layout: 'compact' } : {}),
  }
}

export const Route = createFileRoute('/')({
  validateSearch,
  search: {
    middlewares: [stripSearchParams(dayViewSearchDefaults)],
  },
  component: DayView,
})

function DayView() {
  const baseFilter = useBaseFilter(true)
  const {
    view: requestedViewMode = 'queue',
    q = '',
    layout,
  } = Route.useSearch()
  const isCompactLayout = layout === 'compact'
  const viewMode = isCompactLayout ? 'queue' : requestedViewMode
  const isKanbanFiltering = viewMode === 'kanban' && q !== ''
  const filteredTasksQuery = useTaskList(
    { ...baseFilter, ...(q === '' ? {} : { q }), limit: 'unlimited' },
    { enabled: isKanbanFiltering },
  )
  useEffect(() => {
    if (!isKanbanFiltering || filteredTasksQuery.error == null) return
    console.error(
      'Failed to fetch filtered tasks for kanban',
      filteredTasksQuery.error,
    )
  }, [filteredTasksQuery.error, isKanbanFiltering])
  const filterTaskIds = useMemo(
    () =>
      isKanbanFiltering
        ? new Set((filteredTasksQuery.data ?? []).map((task) => task.id))
        : undefined,
    [filteredTasksQuery.data, isKanbanFiltering],
  )
  const navigate = Route.useNavigate()
  const handleViewModeChange = (mode: DayViewMode) => {
    void navigate({
      search: (prev) => ({ ...prev, view: mode }),
      replace: true,
    })
  }
  const handleFilterQueryChange = (newQuery: string) => {
    void navigate({
      search: (prev) => ({ ...prev, q: newQuery }),
      replace: true,
    })
  }

  const { selectedDate, setSelectedDate } = useSelectedDate()
  const selectedDateStr = useMemo(
    () => formatLocalDate(selectedDate),
    [selectedDate],
  )
  const queueCarryOver = useQueueCarryOver(selectedDateStr)
  const canReadQueueItems = queueCarryOver.canReadQueueItems
  const [visibleRange, setVisibleRange] = useState(() => ({
    startDate: selectedDateStr,
    endDate: selectedDateStr,
  }))
  const handleVisibleRangeChange = useCallback(
    (range: { start: Date; end: Date }) => {
      setVisibleRange(toLocalDateRange(range.start, range.end))
    },
    [],
  )
  // Falls back to a single-day range when selectedDate moves outside the
  // last-reported visible range, until the calendar reports its new one.
  useEffect(() => {
    setVisibleRange((prev) =>
      selectedDateStr >= prev.startDate && selectedDateStr <= prev.endDate
        ? prev
        : { startDate: selectedDateStr, endDate: selectedDateStr },
    )
  }, [selectedDateStr])
  const timeBlocksQuery = useTimeBlocks(
    visibleRange.startDate,
    visibleRange.endDate,
  )
  const { data: timeBlocksData } = timeBlocksQuery
  const schedulesQuery = useScheduleList(
    visibleRange.startDate,
    visibleRange.endDate,
  )
  const { data: schedulesData } = schedulesQuery
  const { data: queuesData } = useQueues()
  const queueItemsResults = useQueueItemsForQueues(
    queuesData,
    selectedDateStr,
    { enabled: canReadQueueItems },
  )
  const updateTimeBlock = useUpdateTimeBlock()
  const createTimeBlock = useCreateTimeBlock()
  const context = useCurrentContext()
  const nowPanelQueryData = useNowPanelQueries({
    enabled: isCompactLayout,
    context,
  })
  const queryClient = useQueryClient()
  const projects = useProjects(ALL_PROJECTS_FILTER)

  const {
    changeFeedback,
    changeFeedbackAnchorRef,
    handleTimeBlockChange,
    dismissChangeFeedback,
  } = useCalendarChangeFeedback(timeBlocksData, updateTimeBlock)

  const gcalEventsQuery = useGcalEvents(
    visibleRange.startDate,
    visibleRange.endDate,
    context,
  )
  const gcalAuthRequired =
    gcalEventsQuery.error instanceof GcalAuthRequiredError ||
    nowPanelQueryData.gcalAuthRequired
  const gcalAuthUrlQuery = useIntegrationAuthUrl(
    'google_calendar',
    gcalAuthRequired,
  )

  useEffect(() => {
    const error = gcalEventsQuery.error
    if (error != null && !(error instanceof GcalAuthRequiredError)) {
      console.error('Failed to fetch Google Calendar events', error)
    }
  }, [gcalEventsQuery.error])

  const setQueueItems = useSetQueueItems()
  const { dayQueueItems, dndCallbacks } = useDayQueueCalendar({
    queues: queuesData,
    startDate: visibleRange.startDate,
    endDate: visibleRange.endDate,
    createTimeBlock,
    setQueueItems,
    onTimeBlockChange: handleTimeBlockChange,
  })

  const futureDayQueueItems = useFutureDayQueueItems({
    selectedDate,
    hasDayQueue:
      queuesData?.some((queue) => queue.key === DAY_QUEUE_KEY) === true,
  })

  // Queue updates replace the full list, so keep stored IDs separate from
  // filters applied to the displayed sections.
  const rawItemsByKey = useMemo(() => {
    const map = new Map<string, QueueItem[]>()
    ;(queuesData ?? []).forEach((queue, i) => {
      map.set(
        queue.key,
        canReadQueueItems ? (queueItemsResults[i]?.data ?? []) : [],
      )
    })
    return map
  }, [canReadQueueItems, queuesData, queueItemsResults])

  const referencedQueueItems = useMemo(
    () => [
      ...[...rawItemsByKey.values()].flat(),
      ...futureDayQueueItems.map(({ item }) => item),
    ],
    [rawItemsByKey, futureDayQueueItems],
  )
  const dayViewTaskData = useDayViewTaskData({
    context,
    selectedDate,
    visibleRange,
    queueItems: referencedQueueItems,
    visibleDayQueueItems: dayQueueItems,
    visibleTimeBlocks: timeBlocksData,
    nowPanelTimeBlocks: isCompactLayout
      ? nowPanelQueryData.timeBlocksData
      : undefined,
    isCompactLayout,
  })
  const {
    isLoading,
    taskMap,
    queueCandidates: allQueueCandidates,
    taskDateTasks,
    tasksDueOnOrBeforeToday,
  } = dayViewTaskData
  useCompactRefreshErrorLogging(isCompactLayout, 'day view', {
    timeBlocks: timeBlocksQuery.error,
    schedules: schedulesQuery.error,
    dueTasks: dayViewTaskData.dueTasksError,
  })
  const {
    now,
    nowPanelProps,
    taskRowStates: compactTaskRowStates,
  } = useNowPanelData({
    queryData: nowPanelQueryData,
    taskMap,
    isTasksLoading: isLoading,
  })
  const compactMemoProps = useCompactMemoData({
    enabled: isCompactLayout,
    context,
  })

  // Completed tasks remain stored but are omitted from non-day queue sections.
  const queueSections = useMemo(
    () =>
      buildQueueSections(
        queuesData,
        rawItemsByKey,
        taskMap,
        selectedDate,
        futureDayQueueItems,
      ),
    [queuesData, rawItemsByKey, taskMap, selectedDate, futureDayQueueItems],
  )

  const filteredQueueSections = useMemo(
    () =>
      filterTaskIds == null
        ? queueSections
        : queueSections.map((section) => {
            const items = section.items.filter((task) =>
              filterTaskIds.has(task.id),
            )
            const dayGroups = section.dayGroups
              ?.map((group) => ({
                ...group,
                items: group.items.filter((task) => filterTaskIds.has(task.id)),
              }))
              .filter((group) => group.items.length > 0)

            return {
              ...section,
              items,
              ...(dayGroups == null ? {} : { dayGroups }),
            }
          }),
    [queueSections, filterTaskIds],
  )

  const visibleQueueSections = useMemo(
    () =>
      isCompactLayout
        ? buildCompactQueueSections(
            filteredQueueSections,
            tasksDueOnOrBeforeToday,
          )
        : filteredQueueSections,
    [isCompactLayout, filteredQueueSections, tasksDueOnOrBeforeToday],
  )

  const dayQueueTasks =
    queueSections.find((q) => q.key === DAY_QUEUE_KEY)?.items ?? []

  const queueCandidates = useMemo(
    () =>
      filterTaskIds == null
        ? allQueueCandidates
        : allQueueCandidates.filter(({ task }) => filterTaskIds.has(task.id)),
    [allQueueCandidates, filterTaskIds],
  )

  const calendarEvents = useDayViewCalendarEvents({
    timeBlocksData,
    schedulesData,
    gcalEventsData: gcalEventsQuery.data,
    dayQueueItems,
    taskMap,
    context,
    taskDateTasks,
    visibleRange,
  })

  const appendedTaskIdsFor = (queueKey: string, taskId: string) => {
    if (setQueueItems.isPending && setQueueItems.variables.key === queueKey)
      return null
    const taskIds = (rawItemsByKey.get(queueKey) ?? []).map(
      (item) => item.taskId,
    )
    return appendQueueTaskId(taskIds, taskId)
  }

  const handleInsertCandidate = (queueKey: string, taskId: string) => {
    const taskIds = appendedTaskIdsFor(queueKey, taskId)
    if (taskIds == null) return
    setQueueItems.mutate({
      key: queueKey,
      date: selectedDateStr,
      taskIds,
    })
  }

  const handleAddCandidate = (taskId: string) => {
    handleInsertCandidate(DAY_QUEUE_KEY, taskId)
  }

  const handleRemoveFromQueue = (queueKey: string, taskId: string) => {
    if (setQueueItems.isPending && setQueueItems.variables.key === queueKey)
      return
    const rawIds = (rawItemsByKey.get(queueKey) ?? []).map(
      (item) => item.taskId,
    )
    setQueueItems.mutate({
      key: queueKey,
      date: selectedDateStr,
      taskIds: rawIds.filter((id) => id !== taskId),
    })
  }

  const handleMoveScheduledTaskToWeek = (taskId: string, date: string) => {
    const weekQueueIndex =
      queuesData?.findIndex((queue) => queue.key === WEEK_QUEUE_KEY) ?? -1
    if (
      weekQueueIndex === -1 ||
      queueItemsResults[weekQueueIndex]?.data == null
    )
      return
    const taskIds = appendedTaskIdsFor(WEEK_QUEUE_KEY, taskId)
    if (taskIds == null) return
    setQueueItems.mutate(
      { key: WEEK_QUEUE_KEY, date, taskIds },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: [...queueKeys.all, WEEK_QUEUE_KEY, 'items'],
          })
          void queryClient.invalidateQueries({
            queryKey: queueKeys.items(DAY_QUEUE_KEY, date),
          })
        },
      },
    )
  }

  const handleMoveTask = (
    taskId: string,
    fromQueueKey: string,
    toQueueKey: string,
  ) => {
    const taskIds = appendedTaskIdsFor(toQueueKey, taskId)
    if (taskIds == null) return
    setQueueItems.mutate(
      {
        key: toQueueKey,
        date: selectedDateStr,
        taskIds,
      },
      {
        onSuccess: () => {
          // The server enforces "at most one queue per task" itself and
          // already dropped this task from fromQueueKey's stored selection
          // — patch its cached items locally instead of refetching so the
          // UI doesn't show the task in both sections until the next fetch.
          queryClient.setQueryData(
            queueKeys.items(fromQueueKey, selectedDateStr),
            (old: QueueItem[] | undefined) =>
              old?.filter((item) => item.taskId !== taskId) ?? old,
          )
        },
      },
    )
  }

  return (
    <>
      <DayViewPresentation
        layout={isCompactLayout ? 'compact' : 'default'}
        nowPanel={nowPanelProps}
        {...(selectedDateStr === formatLocalDate(now)
          ? { taskRowStates: compactTaskRowStates }
          : {})}
        compactMemo={compactMemoProps}
        isLoading={
          isLoading ||
          queueCarryOver.isCarryingOver ||
          (isKanbanFiltering && filteredTasksQuery.isLoading)
        }
        calendarEvents={calendarEvents}
        schedules={schedulesData ?? []}
        dndCallbacks={dndCallbacks}
        onCreateTimeBlock={createTimeBlock.mutate}
        {...(gcalAuthRequired && gcalAuthUrlQuery.data?.url != null
          ? { gcalAuthUrl: gcalAuthUrlQuery.data.url }
          : {})}
        queueSections={visibleQueueSections}
        dayQueueTasks={dayQueueTasks}
        queueCandidates={queueCandidates}
        onMoveTask={handleMoveTask}
        onInsertCandidate={handleInsertCandidate}
        onAddCandidate={handleAddCandidate}
        onRemoveFromQueue={handleRemoveFromQueue}
        onMoveScheduledTaskToWeek={handleMoveScheduledTaskToWeek}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onVisibleRangeChange={handleVisibleRangeChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        kanbanFilterRow={
          <KanbanFilterRow
            onQueryChange={handleFilterQueryChange}
            query={q}
            projects={projects.data ?? []}
          />
        }
      />
      <CalendarChangeFeedbackPopup
        anchor={changeFeedbackAnchorRef}
        feedback={changeFeedback}
        onOpenChange={(open) => {
          if (!open) dismissChangeFeedback()
        }}
      />
    </>
  )
}
