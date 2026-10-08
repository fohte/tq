/** Format a Date as a local "YYYY-MM-DD" string (no UTC conversion). */
export function formatLocalDate(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addLocalDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00`)
  result.setDate(result.getDate() + days)
  return formatLocalDate(result)
}

export function getLocalDateRangeDays(
  startDate: string,
  endDate: string,
): string[] {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = addLocalDays(date, 1)) {
    dates.push(date)
  }
  return dates
}

export function getLocalWeekDateRange(date: Date): {
  startDate: string
  endDate: string
} {
  const dayOfWeek = date.getDay()
  const start = new Date(date)
  start.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) }
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
  const { startDate, endDate } = getLocalWeekDateRange(date)
  return `${startDate.slice(5)} – ${endDate.slice(5)}`
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

/**
 * Convert a FullCalendar `datesSet` visible range (exclusive `end`) into
 * inclusive local "YYYY-MM-DD" start/end date strings.
 */
export function toLocalDateRange(
  start: Date,
  end: Date,
): { startDate: string; endDate: string } {
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(new Date(end.getTime() - 1)),
  }
}
