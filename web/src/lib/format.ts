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

/** Format an instant as "Mon D, H:MM AM/PM", or with a year when it falls outside the current year. */
export function formatShortDateTime(
  isoString: string,
  now: Date = new Date(),
): string {
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: yearIfDifferent(date, now),
    hour: 'numeric',
    minute: '2-digit',
  })
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
