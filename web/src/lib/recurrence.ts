import { computeNextDate } from 'api/services/recurrence'
import { err, ok, type Result } from 'neverthrow'

import {
  dayLabels,
  type RecurrenceType,
} from '#components/schedule/create-schedule-modal'
import { addLocalDays } from '#lib/date-range'
import { ordinal } from '#lib/format'

export interface RecurrenceRule {
  type: RecurrenceType
  interval: number
  daysOfWeek?: number[] | null
  dayOfMonth?: number | null
}

export function parseRecurrenceInterval(input: string): number | null {
  const value = Number(input)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

// The subset of RecurrenceType a recurrence-editing popup's Select offers —
// 'custom' is only reachable via the API/MCP, never chosen through this UI.
export type RecurrenceTypeOption = '' | 'daily' | 'weekly' | 'monthly'

/**
 * Assemble a draft recurrence rule from a recurrence-editing popup's
 * controls, or null if the draft doesn't describe a rule yet (type unset or
 * interval invalid).
 */
export function buildRecurrenceRule(
  type: RecurrenceTypeOption,
  interval: number | null,
  daysOfWeek: number[],
  dayOfMonth: string,
) {
  if (type === '' || interval == null) return null
  return {
    type,
    interval,
    ...(type === 'weekly' && daysOfWeek.length > 0
      ? { daysOfWeek: [...daysOfWeek].sort((a, b) => a - b) }
      : {}),
    ...(type === 'monthly' && dayOfMonth
      ? { dayOfMonth: Number.parseInt(dayOfMonth, 10) }
      : {}),
  }
}

export function intervalUnitLabel(
  type: 'daily' | 'weekly' | 'monthly',
  interval: number,
): string {
  const plural = interval !== 1
  switch (type) {
    case 'daily':
      return plural ? 'days' : 'day'
    case 'weekly':
      return plural ? 'weeks' : 'week'
    case 'monthly':
      return plural ? 'months' : 'month'
  }
}

/** Human-readable summary of a recurrence rule, e.g. "Weekly · Sun, Wed". */
export function formatRecurrenceSummary(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'daily':
      return rule.interval === 1
        ? 'Daily'
        : `Every ${String(rule.interval)} days`
    case 'weekly': {
      const base =
        rule.interval === 1 ? 'Weekly' : `Every ${String(rule.interval)} weeks`
      const days = rule.daysOfWeek
      if (days == null || days.length === 0) return base
      const labels = [...days]
        .sort((a, b) => a - b)
        // daysOfWeek is validated to 0-6 server-side (recurrenceRuleSchema),
        // so the fallback below is unreachable.
        .map((d) => dayLabels[d] ?? '?')
      return `${base} · ${labels.join(', ')}`
    }
    case 'monthly': {
      const base =
        rule.interval === 1
          ? 'Monthly'
          : `Every ${String(rule.interval)} months`
      return rule.dayOfMonth != null
        ? `${base} · ${ordinal(rule.dayOfMonth)}`
        : base
    }
    case 'custom':
      return rule.interval === 1
        ? 'Custom'
        : `Custom · every ${String(rule.interval)} days`
  }
}

/**
 * Next occurrence date ('YYYY-MM-DD') after `baseDate`, delegating to the
 * API's own computation so the preview always matches what the server
 * would actually create.
 */
export function computeNextOccurrence(
  baseDate: string,
  rule: RecurrenceRule,
): string | null {
  return computeNextDate(baseDate, rule).unwrapOr(null)
}

/**
 * Find the API anchor date that makes `firstDate` the next occurrence. Weekly
 * and monthly rules inherit their missing date selector from the first date.
 */
export function anchorDateForFirstOccurrence(
  firstDate: string,
  rule: RecurrenceRule,
): Result<{ anchorDate: string; recurrenceRule: RecurrenceRule }, string> {
  const recurrenceRule: RecurrenceRule = {
    ...rule,
    ...(rule.type === 'weekly' &&
    (rule.daysOfWeek == null || rule.daysOfWeek.length === 0)
      ? { daysOfWeek: [new Date(`${firstDate}T00:00:00`).getDay()] }
      : {}),
    ...(rule.type === 'monthly' && rule.dayOfMonth == null
      ? { dayOfMonth: Number(firstDate.slice(8, 10)) }
      : {}),
  }

  const searchDays =
    recurrenceRule.type === 'daily' || recurrenceRule.type === 'custom'
      ? recurrenceRule.interval
      : recurrenceRule.type === 'weekly'
        ? 7 * recurrenceRule.interval
        : 31 * recurrenceRule.interval

  for (let daysBefore = 1; daysBefore <= searchDays; daysBefore += 1) {
    const candidate = addLocalDays(firstDate, -daysBefore)
    if (
      computeNextDate(candidate, recurrenceRule).unwrapOr(null) === firstDate
    ) {
      return ok({ anchorDate: candidate, recurrenceRule })
    }
  }

  return err('The first date does not match the recurrence rule.')
}

/**
 * Next occurrence for a recurring template, matching
 * `generateForTemplate`'s `lastGeneratedDate ?? anchorDate` base-date choice
 * in `api/src/services/recurring-task-scheduler.ts`.
 */
export function templateNextOccurrence(template: {
  lastGeneratedDate: string | null
  anchorDate: string
  recurrenceRule: RecurrenceRule
}): string | null {
  return computeNextOccurrence(
    template.lastGeneratedDate ?? template.anchorDate,
    template.recurrenceRule,
  )
}
