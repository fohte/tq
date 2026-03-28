import type { EventApi } from '@fullcalendar/core'

export interface CalendarEventProps {
  type?: 'manual' | 'auto' | 'gcal' | 'completed' | 'schedule'
  duration?: string
  parentRef?: string
  label?: string
  color?: { bg: string; accent: string }
  icon?: string
  taskId?: string
}

/**
 * Extract typed extended properties from a FullCalendar event.
 * FullCalendar types extendedProps as Record<string, any>.
 */
export function getEventProps(event: EventApi): CalendarEventProps {
  // FullCalendar types extendedProps as Record<string, any>

  return event.extendedProps as CalendarEventProps
}
