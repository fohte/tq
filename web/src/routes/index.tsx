import { createFileRoute } from '@tanstack/react-router'
import type { CalendarDndCallbacks } from '@web/components/calendar/calendar-grid'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { DayViewPresentation } from '@web/components/day-view/day-view'
import { useContextFilter } from '@web/hooks/use-context-filter'
import {
  GcalAuthRequiredError,
  useGcalAuthUrl,
  useGcalEvents,
} from '@web/hooks/use-gcal-events'
import { useScheduleList } from '@web/hooks/use-schedules'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskList, useTaskMap } from '@web/hooks/use-tasks'
import {
  useCreateTimeBlock,
  useTimeBlocks,
  useUpdateTimeBlock,
} from '@web/hooks/use-time-blocks'
import {
  useAutoAssign,
  useSetTodayTasks,
  useTodayTasks,
} from '@web/hooks/use-today-tasks'
import { matchesContextFilter } from '@web/lib/context-filter'
import { formatLocalDate } from '@web/lib/date-range'
import { formatMinutes } from '@web/lib/format'
import { scheduleColorToEventColor } from '@web/lib/schedule-color'
import { useEffect, useMemo } from 'react'

export const Route = createFileRoute('/')({
  component: DayView,
})

function DayView() {
  const { isLoading, categorized } = useTaskList()

  const todayStr = useMemo(() => formatLocalDate(new Date()), [])
  const { data: timeBlocksData } = useTimeBlocks(todayStr)
  const { data: schedulesData } = useScheduleList(todayStr)
  const { data: todayTasksData } = useTodayTasks(todayStr)
  const updateTimeBlock = useUpdateTimeBlock()
  const createTimeBlock = useCreateTimeBlock()
  const { mode: contextMode } = useContextFilter()

  const gcalEventsQuery = useGcalEvents(todayStr)
  const gcalAuthRequired =
    gcalEventsQuery.error instanceof GcalAuthRequiredError
  const gcalAuthUrlQuery = useGcalAuthUrl(gcalAuthRequired)

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

  const taskEvents: TimeBlockEvent[] = useMemo(() => {
    if (!timeBlocksData) return []
    return timeBlocksData
      .filter(
        (block): block is typeof block & { endTime: string } =>
          block.endTime !== null,
      )
      .map((block) => {
        const task = taskMap.get(block.taskId)
        const durationMs =
          new Date(block.endTime).getTime() -
          new Date(block.startTime).getTime()
        const durationMinutes = Math.round(durationMs / 60000)
        const durationStr = formatMinutes(durationMinutes)

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
          duration: durationStr,
          redacted: !matchesContextFilter(
            task?.context ?? 'personal',
            contextMode,
          ),
        }
      })
  }, [timeBlocksData, taskMap, contextMode])

  const scheduleEvents: TimeBlockEvent[] = useMemo(() => {
    if (!schedulesData) return []
    return schedulesData.map((schedule) => {
      const durationMs =
        new Date(schedule.end).getTime() - new Date(schedule.start).getTime()
      const durationMinutes = Math.round(durationMs / 60000)
      const durationStr = formatMinutes(durationMinutes)

      return {
        id: `schedule-${schedule.scheduleId}-${schedule.start}`,
        title: schedule.title,
        start: schedule.start,
        end: schedule.end,
        type: 'schedule' as const,
        duration: durationStr,
        color: scheduleColorToEventColor(schedule.color),
        redacted: !matchesContextFilter(schedule.context, contextMode),
      }
    })
  }, [schedulesData, contextMode])

  const gcalEvents: TimeBlockEvent[] = useMemo(() => {
    if (!gcalEventsQuery.data) return []
    // Google Calendar has no work/personal/dev context, so these are never
    // redacted by the context filter.
    return gcalEventsQuery.data
      .filter((event) => !event.isAllDay)
      .map((event) => ({
        id: `gcal-${event.id}`,
        title: event.summary,
        start: event.startTime,
        end: event.endTime,
        type: 'gcal' as const,
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
    setTodayTasks.mutate({ date: todayStr, taskIds })
  }

  const handleToggleQueueTask = (taskId: string) => {
    if (setTodayTasks.isPending) return
    const taskIds = queueTaskIdSet.has(taskId)
      ? queueTaskIds.filter((id) => id !== taskId)
      : [...queueTaskIds, taskId]
    setTodayTasks.mutate({ date: todayStr, taskIds })
  }

  const handleAutoAssign = () => {
    autoAssign.mutate({
      date: todayStr,
      tzOffset: new Date().getTimezoneOffset(),
    })
  }

  return (
    <DayViewPresentation
      isLoading={isLoading}
      categorized={categorized}
      calendarEvents={calendarEvents}
      dndCallbacks={dndCallbacks}
      {...(gcalAuthRequired && gcalAuthUrlQuery.data?.url != null
        ? { gcalAuthUrl: gcalAuthUrlQuery.data.url }
        : {})}
      queueTasks={queueTasks}
      queueTaskIds={queueTaskIdSet}
      onReorderQueue={handleReorderQueue}
      onToggleQueueTask={handleToggleQueueTask}
      onRemoveFromQueue={handleToggleQueueTask}
      onAutoAssign={handleAutoAssign}
      isAutoAssigning={autoAssign.isPending}
    />
  )
}
