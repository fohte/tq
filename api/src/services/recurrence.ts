import { err, ok, type Result } from 'neverthrow'

export class EmptyDaysOfWeekError extends Error {
  constructor() {
    super('daysOfWeek must be non-empty')
    this.name = 'EmptyDaysOfWeekError'
  }
}

export interface RecurrenceRuleInput {
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
  daysOfWeek?: number[] | null
  dayOfMonth?: number | null
}

/**
 * Compute the next occurrence date based on a recurrence rule.
 * Returns a 'YYYY-MM-DD' string, or an EmptyDaysOfWeekError if a weekly
 * rule has no matching days left to search.
 */
export function computeNextDate(
  baseDate: string,
  rule: RecurrenceRuleInput,
): Result<string, EmptyDaysOfWeekError> {
  const base = new Date(baseDate + 'T00:00:00')

  switch (rule.type) {
    case 'daily':
    case 'custom': {
      base.setDate(base.getDate() + rule.interval)
      return ok(formatDate(base))
    }

    case 'weekly': {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        return computeNextWeeklyDate(base, rule.interval, rule.daysOfWeek)
      }
      // No specific days: advance by interval weeks
      base.setDate(base.getDate() + 7 * rule.interval)
      return ok(formatDate(base))
    }

    case 'monthly': {
      const targetDay = rule.dayOfMonth ?? base.getDate()
      // Use day=1 to avoid month overflow when calling setMonth
      const nextMonth = new Date(
        base.getFullYear(),
        base.getMonth() + rule.interval,
        1,
      )
      // Clamp to last day of month if target day exceeds month length
      const lastDay = new Date(
        nextMonth.getFullYear(),
        nextMonth.getMonth() + 1,
        0,
      ).getDate()
      nextMonth.setDate(Math.min(targetDay, lastDay))
      return ok(formatDate(nextMonth))
    }
  }
}

function computeNextWeeklyDate(
  base: Date,
  interval: number,
  daysOfWeek: number[],
): Result<string, EmptyDaysOfWeekError> {
  const sorted = [...daysOfWeek].sort((a, b) => a - b)
  const currentDay = base.getDay() // 0=Sun, 6=Sat

  if (interval === 1) {
    // Find the next matching day of week after the base date
    for (const dow of sorted) {
      if (dow > currentDay) {
        const diff = dow - currentDay
        const next = new Date(base)
        next.setDate(next.getDate() + diff)
        return ok(formatDate(next))
      }
    }
    // Wrap to next week, first matching day
    const firstDay = sorted[0]
    if (firstDay === undefined) {
      // Unreachable: computeNextDate only calls this function after checking
      // rule.daysOfWeek.length > 0, and sorted is a same-length copy of it.
      return err(new EmptyDaysOfWeekError())
    }
    const diff = 7 - currentDay + firstDay
    const next = new Date(base)
    next.setDate(next.getDate() + diff)
    return ok(formatDate(next))
  }

  // interval > 1: first check remaining days in current week
  for (const dow of sorted) {
    if (dow > currentDay) {
      const diff = dow - currentDay
      const next = new Date(base)
      next.setDate(next.getDate() + diff)
      return ok(formatDate(next))
    }
  }

  // No remaining days this week: skip to the interval-th week's first matching day
  const daysUntilNextWeekStart = 7 - currentDay + 7 * (interval - 1)
  const weekStart = new Date(base)
  weekStart.setDate(weekStart.getDate() + daysUntilNextWeekStart) // This is a Sunday

  const firstDay = sorted[0]
  if (firstDay === undefined) {
    // Unreachable: computeNextDate only calls this function after checking
    // rule.daysOfWeek.length > 0, and sorted is a same-length copy of it.
    return err(new EmptyDaysOfWeekError())
  }
  const next = new Date(weekStart)
  next.setDate(next.getDate() + firstDay)
  return ok(formatDate(next))
}

/**
 * Every occurrence date strictly after `baseDate` up to and including
 * `today`, in chronological order. Lets a template that fell behind by
 * more than one occurrence (e.g. disabled for weeks) catch up in a single
 * call instead of one occurrence per invocation.
 */
export function computeDueOccurrences(
  baseDate: string,
  rule: RecurrenceRuleInput,
  today: string,
): Result<string[], EmptyDaysOfWeekError> {
  const dates: string[] = []
  let current = baseDate
  for (;;) {
    const nextResult = computeNextDate(current, rule)
    if (nextResult.isErr()) return err(nextResult.error)
    if (nextResult.value > today) return ok(dates)
    dates.push(nextResult.value)
    current = nextResult.value
  }
}

export function formatDate(d: Date): string {
  const year = String(d.getFullYear())
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
