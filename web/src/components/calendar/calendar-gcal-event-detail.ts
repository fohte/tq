export interface CalendarGcalAttendee {
  email: string | null
  displayName: string | null
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted' | null
  isSelf: boolean
  isOrganizer: boolean
}

export interface CalendarGcalEventDetails {
  title: string
  start: string
  end: string
  allDay: boolean
  calendarDisplayName: string | null
  calendarColor: string | null
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted' | null
  meetingUrl: string | null
  htmlLink: string | null
  location: string | null
  description: string | null
  organizer: { email: string | null; displayName: string | null } | null
  attendees: CalendarGcalAttendee[]
}
