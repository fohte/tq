import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { CalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail'
import { makeCalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail-test-fixtures'
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
})
