/** Format a Date as a local "YYYY-MM-DD" string (no UTC conversion). */
export function formatLocalDate(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Format a Date as local "MM-DD", for a queue section's date-range label. */
export function formatShortDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * "MM-DD – MM-DD" for the Monday..Sunday week containing `date`, matching
 * the API's week-queue period rounding (see resolvePeriodStart in
 * api/src/services/task-queues.ts) so the label always reflects the same
 * period the server stored the queue's items under.
 */
export function formatWeekRangeLabel(date: Date): string {
  const dow = date.getDay()
  const monday = new Date(date)
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${formatShortDate(monday)} – ${formatShortDate(sunday)}`
}

/**
 * Convert a local "YYYY-MM-DD" date string into the UTC ISO datetime range
 * covering that local day, for querying APIs that take timeMin/timeMax.
 */
export function getDayIsoRange(date: string): {
  timeMin: string
  timeMax: string
} {
  const parts = date.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  const start = new Date(year, month - 1, day)
  const end = new Date(year, month - 1, day + 1)

  return { timeMin: start.toISOString(), timeMax: end.toISOString() }
}
