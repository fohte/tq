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
