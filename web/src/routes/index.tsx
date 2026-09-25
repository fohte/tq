import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { parseSearchQuery } from 'api/search-query-parser'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CalendarChangeFeedbackPopup } from '#components/calendar/calendar-change-feedback-popup'
import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import {
  type DayViewMode,
  DayViewPresentation,
} from '#components/day-view/day-view'
import { buildQueueSections } from '#components/day-view/queue-sections'
import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { useAutoAssign } from '#hooks/use-auto-assign'
import { useCalendarChangeFeedback } from '#hooks/use-calendar-change-feedback'
import { useCurrentContext } from '#hooks/use-current-context'
import { useBaseFilter } from '#hooks/use-filtered-tasks'
import {
  GcalAuthRequiredError,
  useAutoRescheduleOnGcalChange,
  useGcalEvents,
} from '#hooks/use-gcal-events'
import { useIntegrationAuthUrl } from '#hooks/use-integrations'
import { useProjects } from '#hooks/use-projects'
import {
  DAY_QUEUE_KEY,
  type QueueItem,
  queueKeys,
  useQueueItemsForQueues,
  useQueues,
  useSetQueueItems,
} from '#hooks/use-queues'
import { useScheduleList } from '#hooks/use-schedules'
import { useSchedulingSettings } from '#hooks/use-scheduling-settings'
import { useSelectedDate } from '#hooks/use-selected-date'
import { useTaskList, useTaskMap } from '#hooks/use-tasks'
import {
  useCreateTimeBlock,
  useTimeBlocks,
  useUpdateTimeBlock,
} from '#hooks/use-time-blocks'
import { classifyGcalEvent } from '#lib/calendar-utils'
import { matchesContextFilter } from '#lib/context-filter'
import { formatLocalDate, toLocalDateRange } from '#lib/date-range'
import { getQueueCandidates } from '#lib/queue-candidates'
import { replaceVisibleQueueTaskIds } from '#lib/queue-task-order'
import { scheduleColorToEventColor } from '#lib/schedule-color'

const dayViewSearchDefaults = { view: 'queue', q: '' } as const

interface DayViewSearch {
  view?: DayViewMode
  q?: string
}

function validateSearch(search: Record<string, unknown>): DayViewSearch {
  const q = typeof search['q'] === 'string' ? search['q'] : undefined
  return {
    view: search['view'] === 'kanban' ? 'kanban' : 'queue',
    ...(q == null || q === '' ? {} : { q }),
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
  const { isLoading, categorized } = useTaskList(baseFilter)

  const { view: viewMode = 'queue', q = '' } = Route.useSearch()
  const isKanbanFiltering = viewMode === 'kanban' && q !== ''
  const filteredTasksQuery = useTaskList(
    { ...baseFilter, ...(q === '' ? {} : { q }) },
    { enabled: isKanbanFiltering },
  )
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
  const { data: timeBlocksData } = useTimeBlocks(
    visibleRange.startDate,
    visibleRange.endDate,
  )
  const { data: schedulesData } = useScheduleList(
    visibleRange.startDate,
    visibleRange.endDate,
  )
  const { data: queuesData } = useQueues()
  const queueItemsResults = useQueueItemsForQueues(queuesData, selectedDateStr)
  const updateTimeBlock = useUpdateTimeBlock()
  const createTimeBlock = useCreateTimeBlock()
  const context = useCurrentContext()
  const queryClient = useQueryClient()
  const projects = useProjects()

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
  const schedulingSettings = useSchedulingSettings()
  const gcalAuthRequired =
    gcalEventsQuery.error instanceof GcalAuthRequiredError
  const gcalAuthUrlQuery = useIntegrationAuthUrl(
    'google_calendar',
    gcalAuthRequired,
  )

  useEffect(() => {
    if (gcalEventsQuery.error != null && !gcalAuthRequired) {
      console.error(
        'Failed to fetch Google Calendar events',
        gcalEventsQuery.error,
      )
    }
  }, [gcalEventsQuery.error, gcalAuthRequired])

  const setQueueItems = useSetQueueItems()
  const autoAssign = useAutoAssign()

  const taskMap = useTaskMap(categorized.all)

  // Queue updates replace the full list, so keep stored IDs separate from
  // filters applied to the displayed sections.
  const rawItemsByKey = useMemo(() => {
    const map = new Map<string, QueueItem[]>()
    ;(queuesData ?? []).forEach((queue, i) => {
      map.set(queue.key, queueItemsResults[i]?.data ?? [])
    })
    return map
  }, [queuesData, queueItemsResults])

  // Completed tasks remain stored but are omitted from non-day queue sections.
  const queueSections = useMemo(
    () => buildQueueSections(queuesData, rawItemsByKey, taskMap, selectedDate),
    [queuesData, rawItemsByKey, taskMap, selectedDate],
  )

  const visibleQueueSections = useMemo(
    () =>
      filterTaskIds == null
        ? queueSections
        : queueSections.map((section) => ({
            ...section,
            items: section.items.filter((task) => filterTaskIds.has(task.id)),
          })),
    [queueSections, filterTaskIds],
  )

  const dayQueueTasks =
    queueSections.find((q) => q.key === DAY_QUEUE_KEY)?.items ?? []

  const allQueuedTaskIds = useMemo(() => {
    const ids = new Set<string>()
    rawItemsByKey.forEach((items) => {
      items.forEach((item) => {
        ids.add(item.taskId)
      })
    })
    return ids
  }, [rawItemsByKey])

  const allQueueCandidates = useMemo(
    () => getQueueCandidates(categorized.all, allQueuedTaskIds),
    [categorized.all, allQueuedTaskIds],
  )
  const queueCandidates = useMemo(
    () =>
      filterTaskIds == null
        ? allQueueCandidates
        : allQueueCandidates.filter(({ task }) => filterTaskIds.has(task.id)),
    [allQueueCandidates, filterTaskIds],
  )

  const taskEvents: TimeBlockEvent[] = useMemo(() => {
    if (!timeBlocksData) return []
    return timeBlocksData.map((block) => {
      const task = taskMap.get(block.taskId)
      const parentTask =
        task?.parentId != null ? taskMap.get(task.parentId) : undefined

      return {
        id: block.id,
        title: task?.title ?? 'Unknown task',
        start: block.startTime,
        end: block.endTime,
        type:
          task?.status === 'completed'
            ? 'completed'
            : block.isAutoScheduled
              ? 'auto'
              : 'manual',
        taskId: block.taskId,
        isAutoScheduled: block.isAutoScheduled,
        ...(parentTask != null
          ? { parentRef: `#${String(parentTask.number)} ${parentTask.title}` }
          : {}),
        redacted: !matchesContextFilter(task?.context ?? 'personal', context),
      }
    })
  }, [timeBlocksData, taskMap, context])

  const scheduleEvents: TimeBlockEvent[] = useMemo(() => {
    if (!schedulesData) return []
    return schedulesData.map((schedule) => {
      return {
        id: `schedule-${schedule.scheduleId}-${schedule.start}`,
        title: schedule.title,
        start: schedule.start,
        end: schedule.end,
        type: 'schedule' as const,
        color: scheduleColorToEventColor(schedule.color),
        scheduleId: schedule.scheduleId,
        redacted: !matchesContextFilter(schedule.context, context),
      }
    })
  }, [schedulesData, context])

  const gcalEvents: TimeBlockEvent[] = useMemo(() => {
    if (!gcalEventsQuery.data) return []
    return gcalEventsQuery.data.map((event) => ({
      id: `gcal-${event.id}`,
      title: event.summary,
      start: event.startTime,
      end: event.endTime,
      type: classifyGcalEvent(event),
      gcalEventType: event.eventType,
      allDay: event.isAllDay,
      calendarColor: event.calendarColor,
      responseStatus: event.responseStatus,
      redacted: event.redacted,
    }))
  }, [gcalEventsQuery.data])

  const calendarEvents: TimeBlockEvent[] = useMemo(
    () => [...taskEvents, ...scheduleEvents, ...gcalEvents],
    [taskEvents, scheduleEvents, gcalEvents],
  )

  const dndCallbacks: CalendarDndCallbacks = useMemo(
    () => ({
      onEventDrop: handleTimeBlockChange,
      onEventResize: handleTimeBlockChange,
      onExternalDrop: ({ taskId, start, end }) => {
        createTimeBlock.mutate({
          taskId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        })
      },
    }),
    [handleTimeBlockChange, createTimeBlock],
  )

  function queueTaskIdsFor(queueKey: string, visibleIds: string[]): string[] {
    const rawIds = (rawItemsByKey.get(queueKey) ?? []).map((i) => i.taskId)
    const previousVisibleIds = visibleIdsFor(queueKey)
    return replaceVisibleQueueTaskIds(rawIds, previousVisibleIds, visibleIds)
  }

  function visibleIdsFor(queueKey: string): string[] {
    return (
      visibleQueueSections
        .find((q) => q.key === queueKey)
        ?.items.map((t) => t.id) ?? []
    )
  }

  const handleReorderQueue = (
    queueKey: string,
    newVisibleTaskIds: string[],
  ) => {
    if (setQueueItems.isPending && setQueueItems.variables.key === queueKey)
      return
    setQueueItems.mutate({
      key: queueKey,
      date: selectedDateStr,
      taskIds: queueTaskIdsFor(queueKey, newVisibleTaskIds),
    })
  }

  const handleInsertCandidate = (
    queueKey: string,
    taskId: string,
    index: number,
  ) => {
    if (setQueueItems.isPending && setQueueItems.variables.key === queueKey)
      return
    const nextVisible = [...visibleIdsFor(queueKey)]
    nextVisible.splice(index, 0, taskId)
    setQueueItems.mutate({
      key: queueKey,
      date: selectedDateStr,
      taskIds: queueTaskIdsFor(queueKey, nextVisible),
    })
  }

  const handleAddCandidate = (taskId: string) => {
    handleInsertCandidate(
      DAY_QUEUE_KEY,
      taskId,
      visibleIdsFor(DAY_QUEUE_KEY).length,
    )
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

  const handleMoveTask = (
    taskId: string,
    fromQueueKey: string,
    toQueueKey: string,
  ) => {
    if (setQueueItems.isPending && setQueueItems.variables.key === toQueueKey)
      return
    const nextVisible = [...visibleIdsFor(toQueueKey), taskId]
    setQueueItems.mutate(
      {
        key: toQueueKey,
        date: selectedDateStr,
        taskIds: queueTaskIdsFor(toQueueKey, nextVisible),
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

  const handleAutoAssign = () => {
    if (autoAssign.isPending) return
    autoAssign.mutate(
      {
        date: selectedDateStr,
        tzOffset: new Date().getTimezoneOffset(),
      },
      {
        onError: (error) => {
          console.error('Failed to auto-assign tasks', error)
        },
      },
    )
  }

  useAutoRescheduleOnGcalChange(
    gcalEventsQuery.data,
    handleAutoAssign,
    schedulingSettings.data?.autoRescheduleOnGcalChange ?? true,
  )

  return (
    <>
      <DayViewPresentation
        isLoading={
          isLoading || (isKanbanFiltering && filteredTasksQuery.isLoading)
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
        onReorderQueue={handleReorderQueue}
        onMoveTask={handleMoveTask}
        onInsertCandidate={handleInsertCandidate}
        onAddCandidate={handleAddCandidate}
        onRemoveFromQueue={handleRemoveFromQueue}
        onAutoAssign={handleAutoAssign}
        isAutoAssigning={autoAssign.isPending}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onVisibleRangeChange={handleVisibleRangeChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        kanbanFilterRow={
          viewMode === 'kanban' ? (
            <TaskFilterChipRow
              onQueryChange={handleFilterQueryChange}
              parsed={parseSearchQuery(q)}
              projects={projects.data ?? []}
              hideStatusFilter
              hideSortFilter
              hideSaveView
            />
          ) : undefined
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
