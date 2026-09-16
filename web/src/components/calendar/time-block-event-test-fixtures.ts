import type { TimeBlockEvent } from '#components/calendar/calendar-view'

export function makeTimeBlockEvent(
  overrides: Partial<TimeBlockEvent> = {},
): TimeBlockEvent {
  return {
    id: '1',
    title: 'Task',
    start: '2024-01-01T09:00:00',
    end: '2024-01-01T10:00:00',
    type: 'manual',
    ...overrides,
  }
}
