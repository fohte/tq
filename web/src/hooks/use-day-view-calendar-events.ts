import { useMemo } from 'react'

import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { mapTaskDateCalendarEvents } from '#hooks/task-date-calendar-events'
import type { GcalEvent } from '#hooks/use-gcal-events'
import type { QueueItem } from '#hooks/use-queues'
import type { Schedule } from '#hooks/use-schedules'
import type { Task } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { classifyGcalEvent } from '#lib/calendar-utils'
import { matchesContextFilter } from '#lib/context-filter'
import { addLocalDays } from '#lib/date-range'
import { scheduleColorToEventColor } from '#lib/schedule-color'

interface DayQueueCalendarItem {
  date: string
  item: QueueItem
  queuePosition: number
}

interface UseDayViewCalendarEventsOptions {
  timeBlocksData: TimeBlock[] | undefined
  schedulesData: Schedule[] | undefined
  gcalEventsData: GcalEvent[] | undefined
  dayQueueItems: DayQueueCalendarItem[]
  taskMap: Map<string, Task>
  context: 'work' | 'personal'
  taskDateTasks?: Task[]
  visibleRange?: { startDate: string; endDate: string }
}

export function useDayViewCalendarEvents({
  timeBlocksData,
  schedulesData,
  gcalEventsData,
  dayQueueItems,
  taskMap,
  context,
  taskDateTasks,
  visibleRange,
}: UseDayViewCalendarEventsOptions): TimeBlockEvent[] {
  const taskEvents: TimeBlockEvent[] = useMemo(() => {
    if (!timeBlocksData) return []
    return timeBlocksData.flatMap((block) => {
      const task = taskMap.get(block.taskId)
      if (task?.status === 'completed') return []

      const parentTask =
        task?.parentId != null ? taskMap.get(task.parentId) : undefined

      return [
        {
          id: block.id,
          title: task?.title ?? 'Unknown task',
          start: block.startTime,
          end: block.endTime,
          type: block.isAutoScheduled ? 'auto' : 'manual',
          taskId: block.taskId,
          isAutoScheduled: block.isAutoScheduled,
          ...(parentTask != null
            ? { parentRef: `#${String(parentTask.number)} ${parentTask.title}` }
            : {}),
          redacted: !matchesContextFilter(task?.context ?? 'personal', context),
        },
      ]
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

  const dayQueueEvents: TimeBlockEvent[] = useMemo(
    () =>
      dayQueueItems.flatMap(({ date, item, queuePosition }) => {
        const task = taskMap.get(item.taskId)
        if (task == null || task.status === 'completed') return []

        return [
          {
            id: `day-queue-${date}-${task.id}`,
            title: task.title,
            start: date,
            end: addLocalDays(date, 1),
            type: 'day-queue',
            taskId: task.id,
            allDay: true,
            queuePosition,
            redacted: !matchesContextFilter(task.context, context),
          },
        ]
      }),
    [dayQueueItems, taskMap, context],
  )

  const gcalEvents: TimeBlockEvent[] = useMemo(() => {
    if (!gcalEventsData) return []
    return gcalEventsData.map((event) => {
      const trimmedMeetingUrl = event.meetingUrl?.trim()
      const meetingUrl =
        trimmedMeetingUrl == null || trimmedMeetingUrl === ''
          ? null
          : trimmedMeetingUrl
      return {
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
        ...(!event.redacted
          ? {
              gcalDetails: {
                title: event.summary,
                start: event.startTime,
                end: event.endTime,
                allDay: event.isAllDay,
                calendarDisplayName: event.calendarDisplayName,
                calendarColor: event.calendarColor,
                responseStatus: event.selfResponseStatus,
                meetingUrl,
                htmlLink: event.htmlLink,
                location: event.location,
                description: event.description,
                organizer: event.organizer,
                attendees: event.attendees,
              },
              ...(meetingUrl == null ? {} : { meetingUrl }),
            }
          : {}),
      }
    })
  }, [gcalEventsData])

  const taskDateEvents = useMemo(
    () =>
      taskDateTasks == null || visibleRange == null
        ? []
        : mapTaskDateCalendarEvents(taskDateTasks, visibleRange),
    [taskDateTasks, visibleRange],
  )

  const calendarEvents: TimeBlockEvent[] = useMemo(
    () => [
      ...dayQueueEvents,
      ...taskEvents,
      ...taskDateEvents,
      ...scheduleEvents,
      ...gcalEvents,
    ],
    [dayQueueEvents, taskEvents, taskDateEvents, scheduleEvents, gcalEvents],
  )

  return calendarEvents
}
