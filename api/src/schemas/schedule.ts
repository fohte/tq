import { z } from 'zod'

import { recurrenceRuleSchema } from '#schemas/recurrence-rule'

export const MAX_SCHEDULE_DATE_RANGE_DAYS = 42
const SCHEDULE_DATE_RANGE_ERROR_MESSAGE = `Date range must be chronological and no longer than ${String(MAX_SCHEDULE_DATE_RANGE_DAYS)} days`

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

export const scheduleTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .describe('Local time in HH:MM format.')

export const createScheduleSchema = z.object({
  title: z.string().min(1),
  startTime: scheduleTimeSchema,
  endTime: scheduleTimeSchema,
  recurrence: recurrenceRuleSchema.optional(),
  context: z.enum(['work', 'personal']).optional(),
  color: z.string().optional(),
})

export const scheduleDateRangeInputSchema = z.object({
  startDate: z.iso
    .date()
    .describe('First local date to include, as YYYY-MM-DD.'),
  endDate: z.iso.date().describe('Last local date to include, as YYYY-MM-DD.'),
})

function isScheduleDateRangeValid({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}): boolean {
  const rangeMilliseconds =
    Date.parse(`${endDate}T00:00:00.000Z`) -
    Date.parse(`${startDate}T00:00:00.000Z`)
  return (
    rangeMilliseconds >= 0 &&
    rangeMilliseconds < MAX_SCHEDULE_DATE_RANGE_DAYS * DAY_IN_MILLISECONDS
  )
}

export function withScheduleDateRange<
  Schema extends z.ZodObject<typeof scheduleDateRangeInputSchema.shape>,
>(schema: Schema) {
  return schema.refine(isScheduleDateRangeValid, {
    message: SCHEDULE_DATE_RANGE_ERROR_MESSAGE,
    path: ['endDate'],
  })
}

export const scheduleDateRangeSchema = withScheduleDateRange(
  scheduleDateRangeInputSchema,
)
