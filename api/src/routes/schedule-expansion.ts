import type { recurrenceRules, scheduleOverrides, schedules } from '#db/schema'

export type ScheduleOverrideTimes = Pick<
  typeof scheduleOverrides.$inferSelect,
  'startTime' | 'endTime' | 'skipped'
>

/**
 * Check if a schedule matches a given date based on its recurrence rule.
 * - No recurrence rule: matches every day
 * - daily: matches every day (interval not yet implemented)
 * - weekly: matches if the date's day-of-week is in daysOfWeek
 * - monthly: matches if the date's day-of-month equals dayOfMonth
 */
export function matchesDate(
  rule: typeof recurrenceRules.$inferSelect | null,
  date: Date,
): boolean {
  if (!rule) return true

  switch (rule.type) {
    case 'daily':
      return true
    case 'weekly': {
      if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return false
      return rule.daysOfWeek.includes(date.getDay())
    }
    case 'monthly': {
      if (rule.dayOfMonth == null) return false
      return date.getDate() === rule.dayOfMonth
    }
    case 'custom':
      return true
    default:
      return true
  }
}

/**
 * Expand a schedule for a given date, handling cross-midnight schedules.
 *
 * Cross-midnight example: startTime=23:00, endTime=07:00
 * - On the start date: 23:00 -> 00:00 (next day)
 * - On the next date: 00:00 -> 07:00
 */
export function expandScheduleForDate(
  schedule: typeof schedules.$inferSelect,
  rule: typeof recurrenceRules.$inferSelect | null,
  dateStr: string,
  overrides: ReadonlyMap<string, ScheduleOverrideTimes> = new Map(),
): Array<{
  scheduleId: string
  title: string
  start: string
  end: string
  context: string
  color: string | null
}> {
  const date = new Date(dateStr + 'T00:00:00')
  const currentOverride = overrides.get(dateStr)
  const currentStartTime = currentOverride?.startTime ?? schedule.startTime
  const currentEndTime = currentOverride?.endTime ?? schedule.endTime
  const isCrossMidnight = currentStartTime > currentEndTime

  const blocks: Array<{
    scheduleId: string
    title: string
    start: string
    end: string
    context: string
    color: string | null
  }> = []

  // Check if the schedule's "start day" is this date
  if (matchesDate(rule, date) && currentOverride?.skipped !== true) {
    if (isCrossMidnight) {
      // Start portion: startTime on this date -> midnight
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      blocks.push({
        scheduleId: schedule.id,
        title: schedule.title,
        start: `${dateStr}T${currentStartTime}:00`,
        end: `${formatDateStr(nextDate)}T00:00:00`,
        context: schedule.context,
        color: schedule.color,
      })
    } else {
      blocks.push({
        scheduleId: schedule.id,
        title: schedule.title,
        start: `${dateStr}T${currentStartTime}:00`,
        end: `${dateStr}T${currentEndTime}:00`,
        context: schedule.context,
        color: schedule.color,
      })
    }
  }

  // Check whether the previous occurrence continues into this date.
  const prevDate = new Date(date)
  prevDate.setDate(prevDate.getDate() - 1)
  const prevDateStr = formatDateStr(prevDate)
  const previousOverride = overrides.get(prevDateStr)
  const previousStartTime = previousOverride?.startTime ?? schedule.startTime
  const previousEndTime = previousOverride?.endTime ?? schedule.endTime
  if (
    previousStartTime > previousEndTime &&
    matchesDate(rule, prevDate) &&
    previousOverride?.skipped !== true
  ) {
    blocks.push({
      scheduleId: schedule.id,
      title: schedule.title,
      start: `${dateStr}T00:00:00`,
      end: `${dateStr}T${previousEndTime}:00`,
      context: schedule.context,
      color: schedule.color,
    })
  }

  return blocks
}

export function formatDateStr(date: Date): string {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
