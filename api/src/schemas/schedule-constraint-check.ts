import { z } from 'zod'

import { recurrenceRuleSchema } from '#schemas/recurrence-rule'
import {
  scheduleDateRangeInputSchema,
  scheduleTimeSchema,
  withScheduleDateRange,
} from '#schemas/schedule'
import { scheduleConstraintSchema } from '#services/schedule-constraints'

export const scheduleConstraintDraftSchema = z.object({
  constraints: scheduleConstraintSchema.nullable().optional(),
  occurrenceChange: z
    .object({
      originalDate: z.iso.date(),
      date: z.iso.date().optional(),
      startTime: scheduleTimeSchema.optional(),
      endTime: scheduleTimeSchema.optional(),
      skipped: z.boolean().optional(),
    })
    .optional(),
  revisionChange: z
    .object({
      effectiveFrom: z.iso.date(),
      startTime: scheduleTimeSchema.optional(),
      endTime: scheduleTimeSchema.optional(),
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
