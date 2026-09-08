const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "2026/09/09 (水) 09:00" */
export function formatAbsoluteReminder(date: Date): string {
  const weekday = WEEKDAY_JA[date.getDay()] ?? ''
  return `${String(date.getFullYear())}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} (${weekday}) ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Sidebar row summary: "今日 09:00" / "明日 09:00", falling back to the full absolute format for anything further out. */
export function formatReminderSummary(
  remindAt: Date,
  now: Date = new Date(),
): string {
  const time = `${pad2(remindAt.getHours())}:${pad2(remindAt.getMinutes())}`
  if (isSameLocalDay(remindAt, now)) return `今日 ${time}`

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (isSameLocalDay(remindAt, tomorrow)) return `明日 ${time}`

  return formatAbsoluteReminder(remindAt)
}

export const REMINDER_PRESETS: readonly string[] = [
  '1時間後',
  '今日18:00',
  '明日09:00',
  '来週月曜09:00',
]

// chrono-node's ja locale has no parser for this idiom (unlike its en locale,
// which handles "in 30 minutes") — https://github.com/wanasit/chrono.
const RELATIVE_DURATION_PATTERN = /^(\d+)(分|時間)後$/

function parseRelativeDuration(text: string, now: Date): Date | null {
  const match = RELATIVE_DURATION_PATTERN.exec(text)
  if (match == null) return null

  const amount = Number(match[1])
  const unitMs = match[2] === '分' ? 60_000 : 3_600_000
  return new Date(now.getTime() + amount * unitMs)
}

/**
 * Parse Japanese natural-language reminder text into an absolute Date.
 * Returns null when the text can't be interpreted — callers must not fall
 * back to "now" or silently drop the input in that case.
 */
export async function parseReminderInput(
  text: string,
  now: Date = new Date(),
): Promise<Date | null> {
  const trimmed = text.trim()
  if (trimmed === '') return null

  const relative = parseRelativeDuration(trimmed, now)
  if (relative != null) return relative

  // Dynamic import keeps chrono-node out of the initial bundle — it's only
  // needed once the reminder popup is opened. The `/ja` locale subpath would
  // trim this further, but Vite 7.3's resolver can't resolve chrono-node's
  // wildcard `exports` entry for it.
  const { ja } = await import('chrono-node')
  return ja.parseDate(trimmed, now, { forwardDate: true })
}
