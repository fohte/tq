import { err, ok, type Result } from 'neverthrow'

import type { recurrenceRules, tasks } from '#db/schema'

type RecurrenceRule = typeof recurrenceRules.$inferSelect
type Task = typeof tasks.$inferSelect

export class EmptyDaysOfWeekError extends Error {
  constructor() {
    super('daysOfWeek must be non-empty')
    this.name = 'EmptyDaysOfWeekError'
  }
}

/**
 * Compute the next occurrence date based on a recurrence rule.
 * Returns a 'YYYY-MM-DD' string, or an EmptyDaysOfWeekError if a weekly
 * rule has no matching days left to search.
 */
export function computeNextDate(
  baseDate: string,
  rule: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek?: number[] | null
    dayOfMonth?: number | null
  },
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

function formatDate(d: Date): string {
  const year = String(d.getFullYear())
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
): Result<
  {
    title: string
    description: string | null
    status: 'todo'
    startDate: string | null
    dueDate: string | null
    estimatedMinutes: number | null
    parentId: string | null
    projectId: string | null
    recurrenceRuleId: string
    context: 'work' | 'personal'
    sortOrder: number
  },
  EmptyDaysOfWeekError
> {
  const today = formatDate(new Date())
  const baseDate = completedTask.dueDate ?? today

  return computeNextDate(baseDate, {
    type: rule.type,
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
  }).map((nextDueDate) => {
    // Shift startDate by the same offset if both startDate and dueDate exist
    let nextStartDate: string | null = null
    if (completedTask.startDate != null && completedTask.dueDate != null) {
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
      status: 'todo' as const,
      startDate: nextStartDate,
      dueDate: nextDueDate,
      estimatedMinutes: completedTask.estimatedMinutes,
      parentId: completedTask.parentId,
      projectId: completedTask.projectId,
      recurrenceRuleId: rule.id,
      context: completedTask.context,
      sortOrder: completedTask.sortOrder,
    }
  })
}
