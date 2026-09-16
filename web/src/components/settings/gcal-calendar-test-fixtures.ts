import type { GcalCalendar } from '#hooks/use-gcal-calendars'

export function makeGcalCalendar(
  overrides: Partial<GcalCalendar> = {},
): GcalCalendar {
  return {
    id: 'fohte@example.com',
    displayName: 'fohte@example.com',
    color: '#D50000',
    primary: true,
    subscribed: true,
    context: null,
    ...overrides,
  }
}
