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

/**
 * Convert a naive local date-time string (no timezone suffix, e.g. from
 * `expandScheduleForDate`) into a real UTC instant.
 */
export function localNaiveDateTimeToUtc(
  naiveDateTime: string,
  tzOffsetMinutes = 0,
): Date {
  const offsetMs = tzOffsetMinutes * 60 * 1000
  const asUtc = new Date(`${naiveDateTime}Z`)
  asUtc.setTime(asUtc.getTime() + offsetMs)
  return asUtc
}
