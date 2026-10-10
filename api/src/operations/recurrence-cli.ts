import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { splitCommaList } from '#lib/split-comma-list'
import { optionString } from '#operations/cli-options'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'

export const recurrenceCliOptions = [
  {
    flags: '--recurrence-type <type>',
    description:
      'Recurrence rule type (daily/weekly/monthly/custom); requires --recurrence-interval',
  },
  {
    flags: '--recurrence-interval <n>',
    description:
      'Recurrence interval (e.g. 2 with type weekly means every 2 weeks)',
  },
  {
    flags: '--recurrence-days-of-week <days>',
    description:
      'Comma-separated days of week for a weekly rule (0=Sunday..6=Saturday)',
  },
  {
    flags: '--recurrence-day-of-month <day>',
    description: 'Day of month (1-31) for a monthly rule',
  },
] as const

type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>

export function recurrenceRuleFromCli(
  options: Record<string, unknown>,
): Result<RecurrenceRule | undefined, Error> {
  const type = optionString(options, 'recurrenceType')
  const interval = optionString(options, 'recurrenceInterval')
  const daysOfWeek = optionString(options, 'recurrenceDaysOfWeek')
  const dayOfMonth = optionString(options, 'recurrenceDayOfMonth')

  if (
    type === undefined &&
    interval === undefined &&
    daysOfWeek === undefined &&
    dayOfMonth === undefined
  ) {
    return ok(undefined)
  }

  const parsed = recurrenceRuleSchema.safeParse({
    type,
    interval: Number(interval),
    ...(daysOfWeek === undefined
      ? {}
      : { daysOfWeek: splitCommaList(daysOfWeek).map(Number) }),
    ...(dayOfMonth === undefined ? {} : { dayOfMonth: Number(dayOfMonth) }),
  })

  return parsed.success
    ? ok(parsed.data)
    : err(new Error(parsed.error.issues[0]?.message ?? 'Invalid value'))
}
