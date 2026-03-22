import type { recurrenceRules, tasks } from '@api/db/schema'

type RecurrenceRule = typeof recurrenceRules.$inferSelect
type Task = typeof tasks.$inferSelect

/**
 * Compute the next occurrence date based on a recurrence rule.
 * Returns a 'YYYY-MM-DD' string.
 */
export function computeNextDate(
  baseDate: string,
  rule: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek?: number[] | null
    dayOfMonth?: number | null
  },
): string {
  const base = new Date(baseDate + 'T00:00:00')

  switch (rule.type) {
    case 'daily':
    case 'custom': {
      base.setDate(base.getDate() + rule.interval)
      return formatDate(base)
    }

    case 'weekly': {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        return computeNextWeeklyDate(base, rule.interval, rule.daysOfWeek)
      }
      // No specific days: advance by interval weeks
      base.setDate(base.getDate() + 7 * rule.interval)
      return formatDate(base)
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
      return formatDate(nextMonth)
    }
  }
}

function computeNextWeeklyDate(
  base: Date,
  interval: number,
  daysOfWeek: number[],
): string {
  const sorted = [...daysOfWeek].sort((a, b) => a - b)
  const currentDay = base.getDay() // 0=Sun, 6=Sat

  if (interval === 1) {
    // Find the next matching day of week after the base date
    for (const dow of sorted) {
      if (dow > currentDay) {
        const diff = dow - currentDay
        const next = new Date(base)
        next.setDate(next.getDate() + diff)
        return formatDate(next)
      }
    }
    // Wrap to next week, first matching day
    const diff = 7 - currentDay + sorted[0]!
    const next = new Date(base)
    next.setDate(next.getDate() + diff)
    return formatDate(next)
  }

  // interval > 1: skip (interval - 1) weeks, then find first matching day
  // Start from the beginning of the next interval-th week
  const daysUntilNextWeekStart = 7 - currentDay + 7 * (interval - 1)
  const weekStart = new Date(base)
  weekStart.setDate(weekStart.getDate() + daysUntilNextWeekStart) // This is a Sunday

  // Find the first matching day in that week
  for (const dow of sorted) {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + dow)
    return formatDate(next)
  }

  // Fallback (should not reach here if daysOfWeek is non-empty)
  return formatDate(weekStart)
}

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Build the data for the next recurring task instance from a completed task.
 */
export function buildNextTaskData(
  completedTask: Task,
  rule: RecurrenceRule,
): {
  title: string
  description: string | null
  status: 'todo'
  startDate: string | null
  dueDate: string | null
  estimatedMinutes: number | null
  parentId: string | null
  projectId: string | null
  recurrenceRuleId: string
  context: 'work' | 'personal' | 'dev'
  sortOrder: number
} {
  const today = formatDate(new Date())
  const baseDate = completedTask.dueDate ?? today

  const nextDueDate = computeNextDate(baseDate, {
    type: rule.type as 'daily' | 'weekly' | 'monthly' | 'custom',
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
  })

  // Shift startDate by the same offset if both startDate and dueDate exist
  let nextStartDate: string | null = null
  if (completedTask.startDate && completedTask.dueDate) {
    const startMs = new Date(completedTask.startDate + 'T00:00:00').getTime()
    const dueMs = new Date(completedTask.dueDate + 'T00:00:00').getTime()
    const offsetDays = Math.round((dueMs - startMs) / (1000 * 60 * 60 * 24))
    const nextDue = new Date(nextDueDate + 'T00:00:00')
    nextDue.setDate(nextDue.getDate() - offsetDays)
    nextStartDate = formatDate(nextDue)
  }

  return {
    title: completedTask.title,
    description: completedTask.description,
    status: 'todo',
    startDate: nextStartDate,
    dueDate: nextDueDate,
    estimatedMinutes: completedTask.estimatedMinutes,
    parentId: completedTask.parentId,
    projectId: completedTask.projectId,
    recurrenceRuleId: rule.id,
    context: completedTask.context as 'work' | 'personal' | 'dev',
    sortOrder: completedTask.sortOrder,
  }
}
