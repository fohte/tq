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
  /** Underlying time block's raw auto-scheduled flag; present when type is 'manual' | 'auto' | 'completed'. Independent of `type`, since a completed task's block can have been either. */
  isAutoScheduled?: boolean
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
 * True when a click on this event has a destination: task detail for
 * manual/auto/completed, the edit modal for schedule. Shared by
 * handleEventClick and the `cursor: pointer` affordance in
 * fullcalendar.css so the two can't drift apart.
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

// 24h / 30min slots (matches slotMinTime/slotMaxTime/slotDuration in
// calendar-grid.tsx).
const SLOTS_PER_DAY = 48

export interface SlotGhostRect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Resolves the day column and 30-minute slot under the pointer, for
 * calendar-grid.tsx's hover-preview ghost. Slot lines overlay day columns
 * in FullCalendar, so the column is found by pointer coordinates rather
 * than `event.target`'s ancestry.
 */
export function findHoveredSlot(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): SlotGhostRect | null {
  const colEl = Array.from(
    container.querySelectorAll<HTMLElement>(
      '.fc-timegrid-col:not(.fc-timegrid-axis)',
    ),
  ).find((col) => {
    const rect = col.getBoundingClientRect()
    return (
      clientX >= rect.left &&
      clientX < rect.right &&
      clientY >= rect.top &&
      clientY < rect.bottom
    )
  })
  if (!colEl) return null

  // Day columns extend beyond the visible scroll area; clip against the scroller bounds.
  const scrollerRect = colEl
    .closest<HTMLElement>('.fc-scroller')
    ?.getBoundingClientRect()
  if (
    scrollerRect &&
    (clientY < scrollerRect.top || clientY >= scrollerRect.bottom)
  ) {
    return null
  }

  // Day columns have no per-slot subdivision, so the slot height is read
  // off a real slot row instead of duplicating it as a constant.
  const slotHeight = container
    .querySelector('.fc-timegrid-slot')
    ?.getBoundingClientRect().height
  if (slotHeight == null) return null

  const containerRect = container.getBoundingClientRect()
  const colRect = colEl.getBoundingClientRect()
  const slotIndex = Math.min(
    Math.max(Math.floor((clientY - colRect.top) / slotHeight), 0),
    SLOTS_PER_DAY - 1,
  )
  return {
    top: colRect.top - containerRect.top + slotIndex * slotHeight,
    left: colRect.left - containerRect.left,
    width: colRect.width,
    height: slotHeight,
  }
}
