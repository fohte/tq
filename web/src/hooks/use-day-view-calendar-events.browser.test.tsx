import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { CalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail'
import { makeCalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail-test-fixtures'
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
  it('maps details only for visible events and omits blank meeting URLs', () => {
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
      }),
    )

    expect(result.current).toEqual([
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
