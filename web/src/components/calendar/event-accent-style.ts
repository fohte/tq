import type { CSSProperties } from 'react'

import type { CalendarEventProps } from '#lib/calendar-utils'

export interface EventAccentStyle extends CSSProperties {
  '--event-accent'?: string | undefined
  '--event-fill'?: string | undefined
}

export interface EventAccentStyleValues {
  accent?: string | undefined
  fill?: string | undefined
}

export interface EventAccent {
  accent?: string | undefined
  fillPercent?: number | undefined
}

export function getEventAccentStyleValues(
  eventAccent: EventAccent | undefined,
): EventAccentStyleValues {
  return {
    accent: eventAccent?.accent,
    fill:
      eventAccent?.fillPercent == null
        ? undefined
        : `${String(eventAccent.fillPercent)}%`,
  }
}

export function getEventAccent(
  props: CalendarEventProps,
): EventAccent | undefined {
  if (props.redacted === true) return undefined

  const type = props.type
  const accent =
    type === 'schedule'
      ? props.color?.accent
      : type != null && type.startsWith('gcal-')
        ? (props.calendarColor ?? 'var(--border)')
        : undefined
  const fillPercent =
    type === 'gcal-solo'
      ? 14
      : type === 'schedule' || type === 'gcal-meeting' || type === 'gcal-info'
        ? 32
        : undefined

  if (accent == null && fillPercent == null) return undefined

  return {
    accent,
    fillPercent,
  }
}
