import type { recurrenceRules, schedules } from '@api/db/schema'

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
): Array<{
  scheduleId: string
  title: string
  start: string
  end: string
  context: string
  color: string | null
}> {
  const date = new Date(dateStr + 'T00:00:00')
  const isCrossMidnight = schedule.startTime > schedule.endTime

  const blocks: Array<{
    scheduleId: string
    title: string
    start: string
    end: string
    context: string
    color: string | null
  }> = []

  // Check if the schedule's "start day" is this date
  if (matchesDate(rule, date)) {
    if (isCrossMidnight) {
      // Start portion: startTime on this date -> midnight
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      blocks.push({
        scheduleId: schedule.id,
        title: schedule.title,
        start: `${dateStr}T${schedule.startTime}:00`,
        end: `${formatDateStr(nextDate)}T00:00:00`,
        context: schedule.context,
        color: schedule.color,
      })
    } else {
      blocks.push({
        scheduleId: schedule.id,
        title: schedule.title,
        start: `${dateStr}T${schedule.startTime}:00`,
        end: `${dateStr}T${schedule.endTime}:00`,
        context: schedule.context,
        color: schedule.color,
      })
    }
  }

  // Check if the schedule's "end day" is this date (cross-midnight continuation)
  if (isCrossMidnight) {
    const prevDate = new Date(date)
    prevDate.setDate(prevDate.getDate() - 1)
    if (matchesDate(rule, prevDate)) {
      blocks.push({
        scheduleId: schedule.id,
        title: schedule.title,
        start: `${dateStr}T00:00:00`,
        end: `${dateStr}T${schedule.endTime}:00`,
        context: schedule.context,
        color: schedule.color,
      })
    }
  }

  return blocks
}

function formatDateStr(date: Date): string {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
