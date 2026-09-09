import type { EventApi } from '@fullcalendar/core'

export interface CalendarEventProps {
  type?:
    | 'manual'
    | 'auto'
    | 'gcal-meeting'
    | 'gcal-solo'
    | 'gcal-status'
    | 'gcal-info'
    | 'completed'
    | 'schedule'
  parentRef?: string
  color?: { accent: string }
  taskId?: string
  scheduleId?: string
  /** Raw start ISO string, used to disambiguate cross-midnight blocks sharing a scheduleId */
  scheduleStart?: string
  redacted?: boolean
  calendarColor?: string | null
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'
  /** Google's raw eventType (e.g. `outOfOffice`), used to pick the status/info icon */
  gcalEventType?: string
}

/**
 * Extract typed extended properties from a FullCalendar event.
 * FullCalendar types extendedProps as Record<string, any>.
 */
export function getEventProps(event: EventApi): CalendarEventProps {
  // FullCalendar types extendedProps as Record<string, any>

  return event.extendedProps
}

/** True for any of the gcal-derived display types (kept in sync with the `'gcal-'` prefix below). */
export function isGcalEventType(type: CalendarEventProps['type']): boolean {
  return type != null && type.startsWith('gcal')
}

const CLICKABLE_EVENT_TYPES = new Set<CalendarEventProps['type']>([
  'manual',
  'auto',
  'completed',
  'schedule',
])

/**
 * True when a click on this event has a destination (task detail for
 * manual/auto/completed, the edit modal for schedule). Drives both
 * handleEventClick's routing and the `cursor: pointer` affordance in
 * fullcalendar.css, so the two can't drift apart. gcal events have no
 * destination yet, and a redacted event hides the content a click would
 * otherwise reveal.
 */
export function isClickableEvent(props: CalendarEventProps): boolean {
  return props.redacted !== true && CLICKABLE_EVENT_TYPES.has(props.type)
}

/** Shared by EventBlock (day/week) and the month-view pill, so they can't drift on which statuses render dimmed. */
export function isPendingGcalResponse(props: CalendarEventProps): boolean {
  return (
    isGcalEventType(props.type) &&
    (props.responseStatus === 'needsAction' ||
      props.responseStatus === 'tentative')
  )
}

// Google's raw eventType values for the 2 status categories, shared with
// event-block.tsx's icon lookup so the two can't drift apart.
export const GCAL_OUT_OF_OFFICE_EVENT_TYPE = 'outOfOffice'
export const GCAL_FOCUS_TIME_EVENT_TYPE = 'focusTime'
export const GCAL_WORKING_LOCATION_EVENT_TYPE = 'workingLocation'

/**
 * Splits Google Calendar's single `gcal` type into 4 categories: a status
 * event (outOfOffice/focusTime) always wins over the default/solo split,
 * and isAllDay/workingLocation always wins over status, since neither
 * occupies a lane on the time grid.
 */
export function classifyGcalEvent(event: {
  eventType: string
  hasOtherAttendees: boolean
  isAllDay: boolean
}): 'gcal-meeting' | 'gcal-solo' | 'gcal-status' | 'gcal-info' {
  if (event.isAllDay || event.eventType === GCAL_WORKING_LOCATION_EVENT_TYPE) {
    return 'gcal-info'
  }
  if (
    event.eventType === GCAL_OUT_OF_OFFICE_EVENT_TYPE ||
    event.eventType === GCAL_FOCUS_TIME_EVENT_TYPE
  ) {
    return 'gcal-status'
  }
  return event.hasOtherAttendees ? 'gcal-meeting' : 'gcal-solo'
}
