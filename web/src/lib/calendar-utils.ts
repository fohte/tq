import type { EventApi } from '@fullcalendar/core'

export interface CalendarEventProps {
  type?: 'manual' | 'auto' | 'gcal' | 'completed' | 'schedule'
  parentRef?: string
  color?: { accent: string }
  taskId?: string
  scheduleId?: string
  /** Raw start ISO string, used to disambiguate cross-midnight blocks sharing a scheduleId */
  scheduleStart?: string
  redacted?: boolean
  calendarColor?: string | null
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'
}

/**
 * Extract typed extended properties from a FullCalendar event.
 * FullCalendar types extendedProps as Record<string, any>.
 */
export function getEventProps(event: EventApi): CalendarEventProps {
  // FullCalendar types extendedProps as Record<string, any>

  return event.extendedProps
}

/** Shared by EventBlock (day/week) and the month-view pill, so they can't drift on which statuses render dimmed. */
export function isPendingGcalResponse(props: CalendarEventProps): boolean {
  return (
    props.type === 'gcal' &&
    (props.responseStatus === 'needsAction' ||
      props.responseStatus === 'tentative')
  )
}
