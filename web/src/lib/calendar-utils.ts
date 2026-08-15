import type { EventApi } from '@fullcalendar/core'

export interface CalendarEventProps {
  type?: 'manual' | 'auto' | 'gcal' | 'completed' | 'schedule'
  parentRef?: string
  color?: { accent: string }
  taskId?: string
  scheduleId?: string
  redacted?: boolean
  calendarColor?: string | null
}

/**
 * Extract typed extended properties from a FullCalendar event.
 * FullCalendar types extendedProps as Record<string, any>.
 */
export function getEventProps(event: EventApi): CalendarEventProps {
  // FullCalendar types extendedProps as Record<string, any>

  return event.extendedProps
}
