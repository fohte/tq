import { recurrenceRuleSchema } from 'api/schemas/recurrence-rule'
import type { Command } from 'commander'
import type { z } from 'zod'

import { splitCommaList } from '#commands/split-comma-list'
import { fail } from '#result'

export interface RecurrenceFlagOptions {
  recurrenceType?: string
  recurrenceInterval?: string
  recurrenceDaysOfWeek?: string
  recurrenceDayOfMonth?: string
}

// recurrenceRule is a nested object, so unlike the schema's scalar fields it
// can't become a single addSchemaOptions-generated flag.
export function addRecurrenceOptions(command: Command): Command {
  return command
    .option(
      '--recurrence-type <type>',
      'Recurrence rule type (daily/weekly/monthly/custom); requires --recurrence-interval',
    )
    .option(
      '--recurrence-interval <n>',
      'Recurrence interval (e.g. 2 with type weekly means every 2 weeks)',
    )
    .option(
      '--recurrence-days-of-week <days>',
      'Comma-separated days of week for a weekly rule (0=Sunday..6=Saturday)',
    )
    .option(
      '--recurrence-day-of-month <day>',
      'Day of month (1-31) for a monthly rule',
    )
}

export function parseRecurrenceRule(
  command: Command,
  options: RecurrenceFlagOptions,
): z.infer<typeof recurrenceRuleSchema> | undefined {
  if (
    options.recurrenceType === undefined &&
    options.recurrenceInterval === undefined &&
    options.recurrenceDaysOfWeek === undefined &&
    options.recurrenceDayOfMonth === undefined
  ) {
    return undefined
  }

  const parsed = recurrenceRuleSchema.safeParse({
    type: options.recurrenceType,
    interval: Number(options.recurrenceInterval),
    ...(options.recurrenceDaysOfWeek !== undefined
      ? {
          daysOfWeek: splitCommaList(options.recurrenceDaysOfWeek).map(Number),
        }
      : {}),
    ...(options.recurrenceDayOfMonth !== undefined
      ? { dayOfMonth: Number(options.recurrenceDayOfMonth) }
      : {}),
  })
  if (!parsed.success) {
    return fail(
      command,
      new Error(parsed.error.issues[0]?.message ?? 'Invalid value'),
    )
  }
  return parsed.data
}
