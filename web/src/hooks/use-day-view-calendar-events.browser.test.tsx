import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeGcalEvent } from '#hooks/gcal-event-test-fixtures'
import { useDayViewCalendarEvents } from '#hooks/use-day-view-calendar-events'

describe('useDayViewCalendarEvents', () => {
  it('maps meeting URLs only for visible events with nonblank URLs', () => {
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

    const { result } = renderHook(() =>
      useDayViewCalendarEvents({
        timeBlocksData: undefined,
        schedulesData: undefined,
        gcalEventsData: [
          visibleMeeting,
          redactedMeeting,
          unlinkedMeeting,
          blankLinkMeeting,
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
      },
    ])
  })
})
