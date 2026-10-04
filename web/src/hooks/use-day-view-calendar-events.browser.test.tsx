import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeGcalEvent } from '#hooks/gcal-event-test-fixtures'
import { useDayViewCalendarEvents } from '#hooks/use-day-view-calendar-events'

describe('useDayViewCalendarEvents', () => {
  it('maps visible meeting URLs and omits URLs from redacted events', () => {
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

    const { result } = renderHook(() =>
      useDayViewCalendarEvents({
        timeBlocksData: undefined,
        schedulesData: undefined,
        gcalEventsData: [visibleMeeting, redactedMeeting],
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
    ])
  })
})
