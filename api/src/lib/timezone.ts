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

export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = new Map(parts.map(({ type, value }) => [type, value]))
  const year = values.get('year') ?? ''
  const month = values.get('month') ?? ''
  const day = values.get('day') ?? ''
  return `${year}-${month}-${day}`
}

export function addCalendarDays(date: string, amount: number): string {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const result = new Date(Date.UTC(year, month - 1, day + amount))
  return result.toISOString().slice(0, 10)
}

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const hour = Number(time.slice(0, 2))
  const minute = Number(time.slice(3, 5))
  const localTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let instant = localTimeAsUtc

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffset(new Date(instant), timeZone)
    const adjusted = localTimeAsUtc - offset
    if (adjusted === instant) break
    instant = adjusted
  }

  return new Date(instant)
}

function getTimeZoneOffset(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const values = new Map(parts.map(({ type, value }) => [type, value]))
  const localTimeAsUtc = Date.UTC(
    Number(values.get('year')),
    Number(values.get('month')) - 1,
    Number(values.get('day')),
    Number(values.get('hour')),
    Number(values.get('minute')),
    Number(values.get('second')),
  )
  const instantToWholeSecond = Math.floor(instant.getTime() / 1000) * 1000
  return localTimeAsUtc - instantToWholeSecond
}
