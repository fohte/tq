function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "2026/09/09 (Wed) 09:00" */
export function formatAbsoluteReminder(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  return `${String(date.getFullYear())}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} (${weekday}) ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Sidebar row summary: "today 09:00" / "tomorrow 09:00", falling back to the full absolute format for anything further out. */
export function formatReminderSummary(
  remindAt: Date,
  now: Date = new Date(),
): string {
  const time = `${pad2(remindAt.getHours())}:${pad2(remindAt.getMinutes())}`
  if (isSameLocalDay(remindAt, now)) return `today ${time}`

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (isSameLocalDay(remindAt, tomorrow)) return `tomorrow ${time}`

  return formatAbsoluteReminder(remindAt)
}

export const REMINDER_PRESETS: readonly string[] = [
  'in 1 hour',
  'today 18:00',
  'tomorrow 09:00',
  'next monday 09:00',
]

// chrono-node's ja locale has no parser for this idiom — https://github.com/wanasit/chrono.
const RELATIVE_DURATION_PATTERN = /^(\d+)(分|時間)後$/

function parseRelativeDuration(text: string, now: Date): Date | null {
  const match = RELATIVE_DURATION_PATTERN.exec(text)
  if (match == null) return null

  const amount = Number(match[1])
  const unitMs = match[2] === '分' ? 60_000 : 3_600_000
  const date = new Date(now.getTime() + amount * unitMs)
  // A large enough amount (e.g. "99999999999時間後") overflows Date's range
  // into an Invalid Date — treat that the same as unparseable input rather
  // than handing callers a Date whose toISOString() throws.
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Parse English or Japanese natural-language reminder text into an absolute Date.
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
  const chronoModule = await import('chrono-node').catch((error: unknown) => {
    console.error('Failed to load chrono-node', error)
    return null
  })
  if (chronoModule == null) return null

  const matches = [chronoModule.en, chronoModule.ja].flatMap((locale) =>
    locale.parse(trimmed, now, { forwardDate: true }),
  )
  const longestMatch = matches.reduce<(typeof matches)[number] | null>(
    (longest, match) =>
      longest == null || match.text.length > longest.text.length
        ? match
        : longest,
    null,
  )

  return longestMatch?.start.date() ?? null
}
