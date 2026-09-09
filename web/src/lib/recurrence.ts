import { computeNextDate } from 'api/services/recurrence'

import { dayLabels } from '#components/schedule/create-schedule-modal'

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
  daysOfWeek?: number[] | null
  dayOfMonth?: number | null
}

function ordinal(n: number): string {
  const s = String(n)
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${s}th`
  switch (n % 10) {
    case 1:
      return `${s}st`
    case 2:
      return `${s}nd`
    case 3:
      return `${s}rd`
    default:
      return `${s}th`
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
