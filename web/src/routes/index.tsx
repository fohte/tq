import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { DayViewPresentation } from '#components/day-view/day-view'
import type { QueueSectionData } from '#components/day-view/queue-pane'
import type { DayViewMode } from '#components/layout/view-mode-toggle'
import { useCurrentContext } from '#hooks/use-current-context'
import { useBaseFilter } from '#hooks/use-filtered-tasks'
import {
  GcalAuthRequiredError,
  useAutoRescheduleOnGcalChange,
  useGcalEvents,
} from '#hooks/use-gcal-events'
import { useIntegrationAuthUrl } from '#hooks/use-integrations'
import {
  type Queue,
  type QueueItem,
  queueKeys,
  useQueueItemsForQueues,
  useQueues,
  useSetQueueItems,
} from '#hooks/use-queues'
import { useScheduleList } from '#hooks/use-schedules'
import { useSchedulingSettings } from '#hooks/use-scheduling-settings'
import { useSelectedDate } from '#hooks/use-selected-date'
import type { Task } from '#hooks/use-tasks'
import { useTaskList, useTaskMap } from '#hooks/use-tasks'
import {
  useCreateTimeBlock,
  useTimeBlocks,
  useUpdateTimeBlock,
} from '#hooks/use-time-blocks'
import { useAutoAssign } from '#hooks/use-today-tasks'
import { matchesContextFilter } from '#lib/context-filter'
import {
  formatLocalDate,
  formatShortDate,
  formatWeekRangeLabel,
} from '#lib/date-range'
import { getQueueCandidates } from '#lib/queue-candidates'
import { scheduleColorToEventColor } from '#lib/schedule-color'

// Auto-assign and the focus view (/today) depend on this key by name — see
// api/src/services/task-queues.ts's DAY_QUEUE_KEY for the backend side of
// the same special-casing.
const DAY_QUEUE_KEY = 'day'

interface DayViewSearch {
  view?: DayViewMode
}

function validateSearch(search: Record<string, unknown>): DayViewSearch {
  return search['view'] === 'kanban' ? { view: 'kanban' } : {}
}

export const Route = createFileRoute('/')({
  validateSearch,
  component: DayView,
})

function dateRangeLabelFor(
  periodUnit: Queue['periodUnit'],
  date: Date,
): string | undefined {
  switch (periodUnit) {
    case 'day':
      return formatShortDate(date)
    case 'week':
      return formatWeekRangeLabel(date)
    default:
      return undefined
  }
}

function DayView() {
  const baseFilter = useBaseFilter(true)
  const { isLoading, categorized } = useTaskList(baseFilter)

  const { view } = Route.useSearch()
  const viewMode: DayViewMode = view ?? 'queue'
  const navigate = Route.useNavigate()
  const handleViewModeChange = (mode: DayViewMode) => {
    void navigate({
      search: mode === 'kanban' ? { view: 'kanban' } : {},
      replace: true,
    })
  }

  const { selectedDate, setSelectedDate } = useSelectedDate()
  const selectedDateStr = useMemo(
    () => formatLocalDate(selectedDate),
    [selectedDate],
  )
  const { data: timeBlocksData } = useTimeBlocks(selectedDateStr)
  const { data: schedulesData } = useScheduleList(selectedDateStr)
  const { data: queuesData } = useQueues()
  const queueItemsResults = useQueueItemsForQueues(queuesData, selectedDateStr)
  const updateTimeBlock = useUpdateTimeBlock()
  const createTimeBlock = useCreateTimeBlock()
  const context = useCurrentContext()
  const queryClient = useQueryClient()

  const gcalEventsQuery = useGcalEvents(selectedDateStr)
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

  // Raw items per queue key, straight from the API — used as the
  // authoritative "what's actually stored" source (unaffected by the
  // completed-task display filtering below).
  const rawItemsByKey = useMemo(() => {
    const map = new Map<string, QueueItem[]>()
    ;(queuesData ?? []).forEach((queue, i) => {
      map.set(queue.key, queueItemsResults[i]?.data ?? [])
    })
    return map
  }, [queuesData, queueItemsResults])

  // A completed task stays visible (with the progress bar) only in the day
  // queue; every other queue hides it and excludes it from its count, but it
  // stays in that queue's stored selection (see the PUT handlers below).
  const queueSections: QueueSectionData[] = useMemo(
    () =>
      (queuesData ?? []).map((queue) => {
        const rawTasks = (rawItemsByKey.get(queue.key) ?? [])
          .map((item) => taskMap.get(item.taskId))
          .filter((t): t is Task => t != null)
        const visibleTasks =
          queue.key === DAY_QUEUE_KEY
            ? rawTasks
            : rawTasks.filter((t) => t.status !== 'completed')
        const dateRangeLabel = dateRangeLabelFor(queue.periodUnit, selectedDate)

        return {
          key: queue.key,
          title: queue.name,
          items: visibleTasks,
          ...(dateRangeLabel != null ? { dateRangeLabel } : {}),
          emptyMessage: `No tasks in ${queue.name}'s queue`,
        }
      }),
    [queuesData, rawItemsByKey, taskMap, selectedDate],
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

  const queueCandidates = useMemo(
    () => getQueueCandidates(categorized.all, allQueuedTaskIds),
    [categorized.all, allQueuedTaskIds],
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
    // Google Calendar has no work/personal context, so these are never
    // redacted by the context filter.
    return gcalEventsQuery.data.map((event) => ({
      id: `gcal-${event.id}`,
      title: event.summary,
      start: event.startTime,
      end: event.endTime,
      type: 'gcal' as const,
      allDay: event.isAllDay,
      calendarColor: event.calendarColor,
    }))
  }, [gcalEventsQuery.data])

  const calendarEvents: TimeBlockEvent[] = useMemo(
    () => [...taskEvents, ...scheduleEvents, ...gcalEvents],
    [taskEvents, scheduleEvents, gcalEvents],
  )

  const dndCallbacks: CalendarDndCallbacks = useMemo(
    () => ({
      onEventDrop: ({ eventId, newStart, newEnd, revert }) => {
        updateTimeBlock.mutate(
          {
            id: eventId,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
            isAutoScheduled: false,
          },
          {
            onError: () => {
              revert()
            },
          },
        )
      },
      onEventResize: ({ eventId, newStart, newEnd, revert }) => {
        updateTimeBlock.mutate(
          {
            id: eventId,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
            isAutoScheduled: false,
          },
          {
            onError: () => {
              revert()
            },
          },
        )
      },
      onExternalDrop: ({ taskId, start, end }) => {
        createTimeBlock.mutate({
          taskId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        })
      },
    }),
    [updateTimeBlock, createTimeBlock],
  )

  // The full stored id list for a queue: the given `visibleIds` (already
  // reordered/inserted/removed by the caller) followed by any completed
  // tasks currently hidden from that queue's section — a PUT fully replaces
  // the queue's selection, so leaving a hidden task out here would silently
  // drop it from storage instead of just hiding it from view.
  function fullTaskIdsFor(queueKey: string, visibleIds: string[]): string[] {
    const rawIds = (rawItemsByKey.get(queueKey) ?? []).map((i) => i.taskId)
    const visibleIdSet = new Set(visibleIds)
    const hiddenIds = rawIds.filter((id) => !visibleIdSet.has(id))
    return [...visibleIds, ...hiddenIds]
  }

  function visibleIdsFor(queueKey: string): string[] {
    return (
      queueSections.find((q) => q.key === queueKey)?.items.map((t) => t.id) ??
      []
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
      taskIds: fullTaskIdsFor(queueKey, newVisibleTaskIds),
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
      taskIds: fullTaskIdsFor(queueKey, nextVisible),
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
    const nextVisible = visibleIdsFor(queueKey).filter((id) => id !== taskId)
    setQueueItems.mutate({
      key: queueKey,
      date: selectedDateStr,
      taskIds: fullTaskIdsFor(queueKey, nextVisible),
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
        taskIds: fullTaskIdsFor(toQueueKey, nextVisible),
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
    <DayViewPresentation
      isLoading={isLoading}
      calendarEvents={calendarEvents}
      schedules={schedulesData ?? []}
      dndCallbacks={dndCallbacks}
      {...(gcalAuthRequired && gcalAuthUrlQuery.data?.url != null
        ? { gcalAuthUrl: gcalAuthUrlQuery.data.url }
        : {})}
      queueSections={queueSections}
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
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
    />
  )
}
