import { z } from 'zod'

import { recurrenceRuleSchema } from '#schemas/recurrence-rule'

export const MAX_SCHEDULE_DATE_RANGE_DAYS = 42
const SCHEDULE_DATE_RANGE_ERROR_MESSAGE = `Date range must be chronological and no longer than ${String(MAX_SCHEDULE_DATE_RANGE_DAYS)} days`

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

const scheduleTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  .describe('Local time in HH:MM format.')

const scheduleReminderMinutesSchema = z
  .number()
  .int()
  .min(0)
  .max(1440)
  .describe('Minutes before an occurrence starts to send a push reminder.')

export const createScheduleSchema = z.object({
  title: z.string().min(1),
  startDate: z.iso
    .date()
    .describe('First local date to include, as YYYY-MM-DD.'),
  startTime: scheduleTimeSchema,
  endTime: scheduleTimeSchema,
  recurrence: recurrenceRuleSchema.optional(),
  remindBeforeMinutes: scheduleReminderMinutesSchema.nullable().optional(),
  context: z.enum(['work', 'personal']).optional(),
  color: z.string().optional(),
})

export const updateScheduleInputSchema = z.object({
  dryRun: z.boolean().optional().describe('Preview changes without saving.'),
  title: z.string().min(1).optional(),
  startDate: z.iso.date().optional(),
  effectiveFrom: z.iso.date().optional(),
  startTime: scheduleTimeSchema.optional(),
  endTime: scheduleTimeSchema.optional(),
  endDate: z.iso.date().nullable().optional(),
  remindBeforeMinutes: scheduleReminderMinutesSchema.nullable().optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
  context: z.enum(['work', 'personal']).nullable().optional(),
  color: z.string().nullable().optional(),
})

export const SCHEDULE_DATE_SELECTION_ERROR_MESSAGE =
  'Specify either startDate or effectiveFrom, not both.'

export function isScheduleDateSelectionValid(input: {
  startDate?: unknown
  effectiveFrom?: unknown
}): boolean {
  return input.startDate === undefined || input.effectiveFrom === undefined
}

export function withScheduleDateSelection<
  Schema extends z.ZodObject<z.ZodRawShape>,
>(schema: Schema) {
  return schema.refine(isScheduleDateSelectionValid, {
    message: SCHEDULE_DATE_SELECTION_ERROR_MESSAGE,
    path: ['effectiveFrom'],
  })
}

export const updateScheduleSchema = withScheduleDateSelection(
  updateScheduleInputSchema,
)

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
