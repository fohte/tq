export function formatHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const DEFAULT_SCROLL_TIME = '08:00:00'

export function getScrollTime(rangeStart: Date, rangeEnd: Date): string {
  const now = new Date()
  if (now < rangeStart || now >= rangeEnd) return DEFAULT_SCROLL_TIME
  // Without the floor, a time shortly after midnight would produce a
  // negative-minutes string that FullCalendar's scrollToTime silently drops.
  const minutes = Math.max(0, now.getHours() * 60 + now.getMinutes() - 60)
  const shifted = new Date(now)
  shifted.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return `${formatHm(shifted)}:00`
}

export function getDayRange(date: Date): [Date, Date] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [start, end]
}
