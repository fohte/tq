import { useMemo } from 'react'

import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import type { GcalEvent } from '#hooks/use-gcal-events'
import type { Schedule } from '#hooks/use-schedules'
import type { Task } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { classifyGcalEvent } from '#lib/calendar-utils'
import { matchesContextFilter } from '#lib/context-filter'
import { scheduleColorToEventColor } from '#lib/schedule-color'

interface UseDayViewCalendarEventsOptions {
  timeBlocksData: TimeBlock[] | undefined
  schedulesData: Schedule[] | undefined
  gcalEventsData: GcalEvent[] | undefined
  taskMap: Map<string, Task>
  context: 'work' | 'personal'
}

export function useDayViewCalendarEvents({
  timeBlocksData,
  schedulesData,
  gcalEventsData,
  taskMap,
  context,
}: UseDayViewCalendarEventsOptions): TimeBlockEvent[] {
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
    if (!gcalEventsData) return []
    return gcalEventsData.map((event) => {
      const trimmedMeetingUrl = event.meetingUrl?.trim()
      const meetingUrl =
        trimmedMeetingUrl == null || trimmedMeetingUrl === ''
          ? null
          : trimmedMeetingUrl
      const selfResponseStatus =
        event.attendees.find((attendee) => attendee.isSelf)?.responseStatus ??
        null
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
                responseStatus: selfResponseStatus,
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

  const calendarEvents: TimeBlockEvent[] = useMemo(
    () => [...taskEvents, ...scheduleEvents, ...gcalEvents],
    [taskEvents, scheduleEvents, gcalEvents],
  )

  return calendarEvents
}
