/**
 * Convert a client-local calendar date into UTC day boundaries.
 * tzOffsetMinutes follows `Date.prototype.getTimezoneOffset()` convention
 * (UTC minus local, e.g. JST/UTC+9 = -540).
 */
export function localDateBoundsToUtc(
  date: string,
  tzOffsetMinutes = 0,
): { dayStart: Date; dayEnd: Date } {
  const offsetMs = tzOffsetMinutes * 60 * 1000
  const dayStart = new Date(`${date}T00:00:00.000Z`)
  dayStart.setTime(dayStart.getTime() + offsetMs)
  const dayEnd = new Date(`${date}T23:59:59.999Z`)
  dayEnd.setTime(dayEnd.getTime() + offsetMs)
  return { dayStart, dayEnd }
}
export function formatDateAtOffset(date: Date, tzOffsetMinutes = 0): string {
  const localDate = new Date(date.getTime() - tzOffsetMinutes * 60 * 1000)
  return `${String(localDate.getUTCFullYear())}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`
}
