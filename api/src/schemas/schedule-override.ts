import { z } from 'zod'

export const scheduleOverrideDateSchema = z.iso.date()

export const scheduleOverrideTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

export const scheduleOverrideOperationInputSchema = z.object({
  scheduleId: z.string().min(1).describe('Recurring schedule ID.'),
  occurrenceDate: scheduleOverrideDateSchema.describe(
    'Date on which this occurrence starts, in YYYY-MM-DD format.',
  ),
  startTime: scheduleOverrideTimeSchema
    .optional()
    .describe('Replacement local start time in HH:MM format.'),
  endTime: scheduleOverrideTimeSchema
    .optional()
    .describe('Replacement local end time in HH:MM format.'),
  mode: z
    .enum(['time', 'skip'])
    .optional()
    .describe('Use skip to omit this occurrence; time is the default.'),
})

export const setScheduleOverrideBodySchema = z.union([
  z.object({ skipped: z.literal(true) }).strict(),
  z
    .object({
      startTime: scheduleOverrideTimeSchema,
      endTime: scheduleOverrideTimeSchema,
      skipped: z.literal(false).optional(),
    })
    .strict(),
])

export const clearScheduleOverrideInputSchema =
  scheduleOverrideOperationInputSchema.pick({
    scheduleId: true,
    occurrenceDate: true,
  })
