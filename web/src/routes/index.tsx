import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { DayViewPresentation } from '#components/day-view/day-view'
import { useCurrentContext } from '#hooks/use-current-context'
import { useBaseFilter } from '#hooks/use-filtered-tasks'
import {
  GcalAuthRequiredError,
  useAutoRescheduleOnGcalChange,
  useGcalEvents,
} from '#hooks/use-gcal-events'
import { useIntegrationAuthUrl } from '#hooks/use-integrations'
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
import {
  useAutoAssign,
  useSetTodayTasks,
  useTodayTasks,
} from '#hooks/use-today-tasks'
import { matchesContextFilter } from '#lib/context-filter'
import { formatLocalDate } from '#lib/date-range'
import { getQueueCandidates } from '#lib/queue-candidates'
import { scheduleColorToEventColor } from '#lib/schedule-color'

export const Route = createFileRoute('/')({
  component: DayView,
})

function DayView() {
  const baseFilter = useBaseFilter(true)
  const { isLoading, categorized } = useTaskList(baseFilter)

  const { selectedDate, setSelectedDate } = useSelectedDate()
  const selectedDateStr = useMemo(
    () => formatLocalDate(selectedDate),
    [selectedDate],
  )
  const { data: timeBlocksData } = useTimeBlocks(selectedDateStr)
  const { data: schedulesData } = useScheduleList(selectedDateStr)
  const { data: todayTasksData } = useTodayTasks(selectedDateStr)
  const updateTimeBlock = useUpdateTimeBlock()
  const createTimeBlock = useCreateTimeBlock()
  const context = useCurrentContext()

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

  const setTodayTasks = useSetTodayTasks()
  const autoAssign = useAutoAssign()

  const taskMap = useTaskMap(categorized.all)

  const queueTaskIds = useMemo(
    () => (todayTasksData ?? []).map((t) => t.taskId),
    [todayTasksData],
  )
  const queueTasks = useMemo(
    () =>
      queueTaskIds
        .map((id) => taskMap.get(id))
        .filter((t): t is Task => t != null),
    [queueTaskIds, taskMap],
  )
  const queueTaskIdSet = useMemo(() => new Set(queueTaskIds), [queueTaskIds])
  const queueCandidates = useMemo(
    () => getQueueCandidates(categorized.all, queueTaskIdSet),
    [categorized.all, queueTaskIdSet],
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

  const handleReorderQueue = (taskIds: string[]) => {
    if (setTodayTasks.isPending) return
    setTodayTasks.mutate({ date: selectedDateStr, taskIds })
  }

  const handleInsertCandidate = (taskId: string, index: number) => {
    if (setTodayTasks.isPending) return
    const nextTaskIds = [...queueTaskIds]
    nextTaskIds.splice(index, 0, taskId)
    setTodayTasks.mutate({ date: selectedDateStr, taskIds: nextTaskIds })
  }

  const handleToggleQueueTask = (taskId: string) => {
    if (setTodayTasks.isPending) return
    const taskIds = queueTaskIdSet.has(taskId)
      ? queueTaskIds.filter((id) => id !== taskId)
      : [...queueTaskIds, taskId]
    setTodayTasks.mutate({ date: selectedDateStr, taskIds })
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
    // Unlike every other route, day view keeps its own internal scroll pane
    // (see day-view.tsx) rather than scrolling the document — its time-grid
    // layout is meant to stay pinned to one viewport, like a native calendar.
    // h-full (not h-dvh): AppLayout gives <main> min-h-0 on this route so it
    // shrinks to its flex-allotted share of the viewport instead of the full
    // viewport — h-dvh here would ignore that and force <main> past it again.
    <div className="h-full overflow-hidden">
      <DayViewPresentation
        isLoading={isLoading}
        calendarEvents={calendarEvents}
        schedules={schedulesData ?? []}
        dndCallbacks={dndCallbacks}
        {...(gcalAuthRequired && gcalAuthUrlQuery.data?.url != null
          ? { gcalAuthUrl: gcalAuthUrlQuery.data.url }
          : {})}
        queueTasks={queueTasks}
        queueCandidates={queueCandidates}
        onReorderQueue={handleReorderQueue}
        onInsertCandidate={handleInsertCandidate}
        onToggleQueueTask={handleToggleQueueTask}
        onRemoveFromQueue={handleToggleQueueTask}
        onAutoAssign={handleAutoAssign}
        isAutoAssigning={autoAssign.isPending}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
    </div>
  )
}
