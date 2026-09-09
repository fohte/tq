export function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${String(h)}h${String(m)}m` : `${String(h)}h`
  }
  return `${String(minutes)}m`
}

function yearIfDifferent(date: Date, now: Date): 'numeric' | undefined {
  return date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatTime24(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Format a future instant by calendar-day closeness: bare time today,
 * "tomorrow H:MM" tomorrow, weekday + time within a week, else "Mon D H:MM".
 * Mirrors formatRelativeTime's 7-day boundary on the future side.
 */
export function formatReminderTime(
  isoString: string,
  now: Date = new Date(),
): string {
  const date = new Date(isoString)
  const time = formatTime24(date)
  const dayDiff = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000,
  )

  if (dayDiff === 0) return time
  if (dayDiff === 1) return `tomorrow ${time}`
  if (dayDiff >= 2 && dayDiff < 7) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
    return `${weekday} ${time}`
  }

  const monthDay = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: yearIfDifferent(date, now),
  })
  return `${monthDay} ${time}`
}

export function formatRelativeTime(
  isoString: string,
  now: Date = new Date(),
): string {
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${String(diffMinutes)}m ago`
  if (diffHours < 24) return `${String(diffHours)}h ago`
  if (diffDays < 7) return `${String(diffDays)}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: yearIfDifferent(date, now),
  })
}
