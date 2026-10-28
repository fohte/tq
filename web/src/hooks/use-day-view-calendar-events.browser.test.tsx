import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { CalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail'
import { makeCalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail-test-fixtures'
import { makeSchedule } from '#components/schedule/schedule-test-fixtures'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import { makeGcalEvent } from '#hooks/gcal-event-test-fixtures'
import { useDayViewCalendarEvents } from '#hooks/use-day-view-calendar-events'

function expectedDetails(
  title: string,
  meetingUrl: string | null,
  responseStatus: CalendarGcalEventDetails['responseStatus'] = null,
  attendees: CalendarGcalEventDetails['attendees'] = [],
): CalendarGcalEventDetails {
  return makeCalendarGcalEventDetails({
    title,
    start: '2031-04-09T15:00:00.000Z',
    end: '2031-04-09T15:30:00.000Z',
    allDay: false,
    calendarDisplayName: null,
    calendarColor: null,
    responseStatus,
    meetingUrl,
    htmlLink: null,
    location: null,
    description: null,
    organizer: null,
    attendees,
  })
}

describe('useDayViewCalendarEvents', () => {
  it('keeps moved and natural occurrences distinct when their times overlap', () => {
    const naturalOccurrence = makeSchedule({
      scheduleId: 'schedule-overlap',
      title: 'Routine',
      startDate: '2034-08-18',
      start: '2034-08-18T09:00:00',
      end: '2034-08-18T10:00:00',
      occurrenceDate: '2034-08-18',
      overridden: null,
      context: 'personal',
      color: null,
      recurrence: null,
    })
    const movedOccurrence = makeSchedule({
      ...naturalOccurrence,
      startDate: '2034-08-18',
      occurrenceDate: '2034-08-17',
      overridden: 'moved',
    })

    const { result } = renderHook(() =>
      useDayViewCalendarEvents({
        timeBlocksData: undefined,
        schedulesData: [naturalOccurrence, movedOccurrence],
        gcalEventsData: undefined,
        dayQueueItems: [],
        taskMap: new Map(),
        context: 'personal',
      }),
    )

    expect(result.current).toEqual([
      {
        id: 'schedule-schedule-overlap-2034-08-18-2034-08-18T09:00:00',
        title: 'Routine',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        type: 'schedule',
        color: { accent: '#6C63FF' },
        scheduleId: 'schedule-overlap',
        scheduleOccurrenceDate: '2034-08-18',
        redacted: false,
      },
      {
        id: 'schedule-schedule-overlap-2034-08-17-2034-08-18T09:00:00',
        title: 'Routine',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        type: 'schedule',
        color: { accent: '#6C63FF' },
        scheduleId: 'schedule-overlap',
        scheduleOccurrenceDate: '2034-08-17',
        scheduleOverridden: 'moved',
        redacted: false,
      },
    ])
  })

  it('removes a past time block when its task is completed', () => {
    const task = makeTask({
      id: 'task-calendar-block',
      title: 'Prepare a sample outline',
      context: 'personal',
    })
    const timeBlock = makeTimeBlock({
      id: 'block-calendar-task',
      taskId: task.id,
      startTime: '2020-02-03T10:00:00.000Z',
      endTime: '2020-02-03T11:00:00.000Z',
    })
    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Map<string, ReturnType<typeof makeTask>> }) =>
        useDayViewCalendarEvents({
          timeBlocksData: [timeBlock],
          schedulesData: undefined,
          gcalEventsData: undefined,
          dayQueueItems: [],
          taskMap: tasks,
          context: 'personal',
        }),
      { initialProps: { tasks: new Map([[task.id, task]]) } },
    )
    const eventsByStatus = [result.current]

    rerender({ tasks: new Map([[task.id, { ...task, status: 'completed' }]]) })
    eventsByStatus.push(result.current)

    expect(eventsByStatus).toEqual([
      [
        {
          id: 'block-calendar-task',
          title: 'Prepare a sample outline',
          start: '2020-02-03T10:00:00.000Z',
          end: '2020-02-03T11:00:00.000Z',
          type: 'manual',
          taskId: 'task-calendar-block',
          isAutoScheduled: false,
          redacted: false,
        },
      ],
      [],
    ])
  })

  it('maps task dates alongside visible events and omits blank meeting URLs', () => {
    const datedTask = makeTask({
      id: 'dated-task',
      title: 'Prepare a sample outline',
      startDate: '2031-04-09',
      dueDate: '2031-04-09',
    })
    const visibleMeeting = makeGcalEvent({
      id: 'visible-meeting',
      summary: 'Product review',
      meetingUrl: 'https://meet.example.com/current-room',
    })
    const redactedMeeting = makeGcalEvent({
      id: 'redacted-meeting',
      summary: 'Busy',
      meetingUrl: 'https://meet.example.com/private-room',
      redacted: true,
    })
    const unlinkedMeeting = makeGcalEvent({
      id: 'unlinked-meeting',
      summary: 'Room check',
    })
    const blankLinkMeeting = makeGcalEvent({
      id: 'blank-link-meeting',
      summary: 'Planning session',
      meetingUrl: '   ',
    })
    const selfResponseMeeting = makeGcalEvent({
      id: 'self-response-meeting',
      summary: 'RSVP check',
      selfResponseStatus: 'tentative',
      attendees: [
        {
          email: 'self@example.org',
          displayName: 'Taylor Quinn',
          responseStatus: 'tentative',
          isSelf: true,
          isOrganizer: false,
        },
      ],
    })

    const { result } = renderHook(() =>
      useDayViewCalendarEvents({
        timeBlocksData: undefined,
        schedulesData: undefined,
        gcalEventsData: [
          visibleMeeting,
          redactedMeeting,
          unlinkedMeeting,
          blankLinkMeeting,
          selfResponseMeeting,
        ],
        dayQueueItems: [],
        taskMap: new Map(),
        context: 'work',
        taskDateTasks: [datedTask],
        visibleRange: { startDate: '2031-04-09', endDate: '2031-04-09' },
      }),
    )

    expect(result.current).toEqual([
      {
        id: 'task-date-dated-task-range',
        title: 'Prepare a sample outline',
        start: '2031-04-09',
        end: '2031-04-10',
        type: 'task-date',
        taskId: 'dated-task',
        allDay: true,
        dateTaskKind: 'range',
      },
      {
        id: 'gcal-visible-meeting',
        title: 'Product review',
        start: '2031-04-09T15:00:00.000Z',
        end: '2031-04-09T15:30:00.000Z',
        type: 'gcal-meeting',
        gcalEventType: 'default',
        allDay: false,
        calendarColor: null,
        responseStatus: 'accepted',
        redacted: false,
        meetingUrl: 'https://meet.example.com/current-room',
        gcalDetails: expectedDetails(
          'Product review',
          'https://meet.example.com/current-room',
        ),
      },
      {
        id: 'gcal-redacted-meeting',
        title: 'Busy',
        start: '2031-04-09T15:00:00.000Z',
        end: '2031-04-09T15:30:00.000Z',
        type: 'gcal-meeting',
        gcalEventType: 'default',
        allDay: false,
        calendarColor: null,
        responseStatus: 'accepted',
        redacted: true,
      },
      {
        id: 'gcal-unlinked-meeting',
        title: 'Room check',
        start: '2031-04-09T15:00:00.000Z',
        end: '2031-04-09T15:30:00.000Z',
        type: 'gcal-meeting',
        gcalEventType: 'default',
        allDay: false,
        calendarColor: null,
        responseStatus: 'accepted',
        redacted: false,
        gcalDetails: expectedDetails('Room check', null),
      },
      {
        id: 'gcal-blank-link-meeting',
        title: 'Planning session',
        start: '2031-04-09T15:00:00.000Z',
        end: '2031-04-09T15:30:00.000Z',
        type: 'gcal-meeting',
        gcalEventType: 'default',
        allDay: false,
        calendarColor: null,
        responseStatus: 'accepted',
        redacted: false,
        gcalDetails: expectedDetails('Planning session', null),
      },
      {
        id: 'gcal-self-response-meeting',
        title: 'RSVP check',
        start: '2031-04-09T15:00:00.000Z',
        end: '2031-04-09T15:30:00.000Z',
        type: 'gcal-meeting',
        gcalEventType: 'default',
        allDay: false,
        calendarColor: null,
        responseStatus: 'accepted',
        redacted: false,
        gcalDetails: expectedDetails('RSVP check', null, 'tentative', [
          {
            email: 'self@example.org',
            displayName: 'Taylor Quinn',
            responseStatus: 'tentative',
            isSelf: true,
            isOrganizer: false,
          },
        ]),
      },
    ])
  })

  it('maps each queued task to an all-day event and omits completed tasks', () => {
    const date = '2026-08-03'
    const queuedTask = makeTask({
      id: 'queued-task-a',
      title: 'Prepare sample outline',
      context: 'work',
      dueDate: '2026-08-06',
    })
    const secondQueuedTask = makeTask({
      id: 'queued-task-b',
      title: 'Review sample outline',
      context: 'work',
    })
    const completedTask = makeTask({
      id: 'queued-task-c',
      title: 'Finalize sample outline',
      context: 'work',
      status: 'completed',
    })

    const { result } = renderHook(() =>
      useDayViewCalendarEvents({
        timeBlocksData: undefined,
        schedulesData: undefined,
        gcalEventsData: undefined,
        dayQueueItems: [
          {
            date,
            item: makeQueueItem({ taskId: queuedTask.id }),
            queuePosition: 0,
          },
          {
            date,
            item: makeQueueItem({ taskId: secondQueuedTask.id }),
            queuePosition: 1,
          },
          {
            date,
            item: makeQueueItem({ taskId: completedTask.id }),
            queuePosition: 2,
          },
        ],
        taskMap: new Map([
          [queuedTask.id, queuedTask],
          [secondQueuedTask.id, secondQueuedTask],
          [completedTask.id, completedTask],
        ]),
        context: 'work',
      }),
    )

    expect(result.current).toEqual([
      {
        id: 'day-queue-2026-08-03-queued-task-a',
        title: 'Prepare sample outline',
        start: '2026-08-03',
        end: '2026-08-04',
        type: 'day-queue',
        taskId: 'queued-task-a',
        allDay: true,
        queuePosition: 0,
        redacted: false,
      },
      {
        id: 'day-queue-2026-08-03-queued-task-b',
        title: 'Review sample outline',
        start: '2026-08-03',
        end: '2026-08-04',
        type: 'day-queue',
        taskId: 'queued-task-b',
        allDay: true,
        queuePosition: 1,
        redacted: false,
      },
    ])
  })

  it('carries wait markers on visible task events and omits them on redacted events', () => {
    const visibleTimeTask = makeTask({
      id: 'visible-time-task',
      title: 'Review a sample outline',
      context: 'work',
      hasUnresolvedWait: true,
    })
    const hiddenTimeTask = makeTask({
      id: 'hidden-time-task',
      title: 'Prepare a private note',
      context: 'personal',
      hasUnresolvedWait: true,
    })
    const visibleQueueTask = makeTask({
      id: 'visible-queue-task',
      title: 'Draft a sample plan',
      context: 'work',
      hasUnresolvedWait: true,
    })
    const hiddenQueueTask = makeTask({
      id: 'hidden-queue-task',
      title: 'Review a private plan',
      context: 'personal',
      hasUnresolvedWait: true,
    })

    const { result } = renderHook(() =>
      useDayViewCalendarEvents({
        timeBlocksData: [
          makeTimeBlock({
            id: 'visible-time-block',
            taskId: visibleTimeTask.id,
            startTime: '2031-04-09T10:00:00.000Z',
            endTime: '2031-04-09T11:30:00.000Z',
          }),
          makeTimeBlock({
            id: 'hidden-time-block',
            taskId: hiddenTimeTask.id,
            startTime: '2031-04-09T10:00:00.000Z',
            endTime: '2031-04-09T11:30:00.000Z',
          }),
        ],
        schedulesData: undefined,
        gcalEventsData: undefined,
        dayQueueItems: [
          {
            date: '2031-04-09',
            item: makeQueueItem({ taskId: visibleQueueTask.id }),
            queuePosition: 0,
          },
          {
            date: '2031-04-09',
            item: makeQueueItem({ taskId: hiddenQueueTask.id }),
            queuePosition: 1,
          },
        ],
        taskMap: new Map([
          [visibleTimeTask.id, visibleTimeTask],
          [hiddenTimeTask.id, hiddenTimeTask],
          [visibleQueueTask.id, visibleQueueTask],
          [hiddenQueueTask.id, hiddenQueueTask],
        ]),
        context: 'work',
      }),
    )

    expect(result.current).toEqual([
      {
        id: 'day-queue-2031-04-09-visible-queue-task',
        title: 'Draft a sample plan',
        start: '2031-04-09',
        end: '2031-04-10',
        type: 'day-queue',
        taskId: 'visible-queue-task',
        allDay: true,
        queuePosition: 0,
        redacted: false,
        hasUnresolvedWait: true,
      },
      {
        id: 'day-queue-2031-04-09-hidden-queue-task',
        title: 'Review a private plan',
        start: '2031-04-09',
        end: '2031-04-10',
        type: 'day-queue',
        taskId: 'hidden-queue-task',
        allDay: true,
        queuePosition: 1,
        redacted: true,
      },
      {
        id: 'visible-time-block',
        title: 'Review a sample outline',
        start: '2031-04-09T10:00:00.000Z',
        end: '2031-04-09T11:30:00.000Z',
        type: 'manual',
        taskId: 'visible-time-task',
        isAutoScheduled: false,
        hasUnresolvedWait: true,
        redacted: false,
      },
      {
        id: 'hidden-time-block',
        title: 'Prepare a private note',
        start: '2031-04-09T10:00:00.000Z',
        end: '2031-04-09T11:30:00.000Z',
        type: 'manual',
        taskId: 'hidden-time-task',
        isAutoScheduled: false,
        redacted: true,
      },
    ])
  })
})
