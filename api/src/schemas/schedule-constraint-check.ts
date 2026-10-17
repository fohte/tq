import { z } from 'zod'

import { recurrenceRuleSchema } from '#schemas/recurrence-rule'
import {
  scheduleDateRangeInputSchema,
  withScheduleDateRange,
} from '#schemas/schedule'
import { scheduleConstraintSchema } from '#services/schedule-constraints'

const scheduleConstraintCheckTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

export const scheduleConstraintDraftSchema = z.object({
  constraints: scheduleConstraintSchema.nullable().optional(),
  occurrenceChange: z
    .object({
      originalDate: z.iso.date(),
      date: z.iso.date().optional(),
      startTime: scheduleConstraintCheckTimeSchema.optional(),
      endTime: scheduleConstraintCheckTimeSchema.optional(),
      skipped: z.boolean().optional(),
    })
    .optional(),
  revisionChange: z
    .object({
      effectiveFrom: z.iso.date(),
      startTime: scheduleConstraintCheckTimeSchema.optional(),
      endTime: scheduleConstraintCheckTimeSchema.optional(),
      recurrence: recurrenceRuleSchema.nullable().optional(),
    })
    .optional(),
  endDate: z.iso.date().nullable().optional(),
  revisionMode: z.enum(['from', 'all', 'replace']).optional(),
})

export const scheduleConstraintCheckSchema = withScheduleDateRange(
  scheduleDateRangeInputSchema.extend({
    draft: scheduleConstraintDraftSchema.optional(),
  }),
)

export type ScheduleConstraintDraft = z.infer<
  typeof scheduleConstraintDraftSchema
>
