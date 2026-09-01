export function formatDate(dateStr: string | null): string | null {
  if (dateStr == null) return null
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getDaysRemaining(
  targetDate: string,
  now: Date = new Date(),
): number {
  const target = new Date(`${targetDate}T00:00:00`)
  const targetUTC = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  )
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((targetUTC - todayUTC) / msPerDay)
}
