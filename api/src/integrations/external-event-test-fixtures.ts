import type { ExternalEvent } from '#integrations/types'

export function makeExternalEvent(
  overrides: Partial<ExternalEvent> = {},
): ExternalEvent {
  return {
    id: 'event-1',
    summary: 'Team standup',
    startTime: '2026-03-22T09:00:00Z',
    endTime: '2026-03-22T09:30:00Z',
    isAllDay: false,
    source: 'google_calendar',
    accountId: 'google-sub-1',
    accountLabel: 'user@example.com',
    calendarId: 'user@example.com',
    calendarDisplayName: null,
    calendarColor: null,
    responseStatus: 'accepted',
    eventType: 'default',
    hasOtherAttendees: false,
    busy: true,
    redacted: false,
    ...overrides,
  }
}
