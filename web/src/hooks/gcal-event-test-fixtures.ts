import type { GcalEvent } from '#hooks/use-gcal-events'

export function makeGcalEvent(overrides: Partial<GcalEvent> = {}): GcalEvent {
  return {
    id: 'event-1',
    summary: 'Calendar event',
    meetingUrl: null,
    startTime: '2031-04-09T15:00:00.000Z',
    endTime: '2031-04-09T15:30:00.000Z',
    isAllDay: false,
    source: 'google_calendar',
    accountId: 'account-1',
    accountLabel: null,
    calendarId: 'calendar-1',
    calendarDisplayName: null,
    calendarColor: null,
    responseStatus: 'accepted',
    htmlLink: null,
    location: null,
    description: null,
    organizer: null,
    attendees: [],
    eventType: 'default',
    hasOtherAttendees: true,
    busy: true,
    redacted: false,
    ...overrides,
  }
}
