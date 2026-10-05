import type { CalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail'

export function makeCalendarGcalEventDetails(
  overrides: Partial<CalendarGcalEventDetails> = {},
): CalendarGcalEventDetails {
  return {
    title: 'Planning session',
    start: '2031-04-09T15:00:00.000Z',
    end: '2031-04-09T15:30:00.000Z',
    allDay: false,
    calendarDisplayName: 'Project calendar',
    calendarColor: '#4285f4',
    responseStatus: 'accepted',
    meetingUrl: 'https://meet.example.org/room',
    htmlLink: 'https://calendar.example.org/event',
    location: 'North conference room',
    description:
      '<p>Agenda and notes</p><p>https://docs.example.org/agenda</p>',
    organizer: { email: 'organizer@example.org', displayName: 'Alex Morgan' },
    attendees: [
      {
        email: 'organizer@example.org',
        displayName: 'Alex Morgan',
        responseStatus: 'accepted',
        isSelf: false,
        isOrganizer: true,
      },
      {
        email: 'participant@example.org',
        displayName: 'Jordan Lee',
        responseStatus: 'tentative',
        isSelf: false,
        isOrganizer: false,
      },
    ],
    ...overrides,
  }
}
