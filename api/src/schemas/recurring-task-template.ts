import { z } from 'zod'

import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'
import { taskIdOrNumber } from '#lib/numeric-id'
import { labelNameSchema } from '#schemas/label-name'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'
import { contextEnum } from '#schemas/task'

export const createRecurringTaskTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().max(MAX_MARKDOWN_CONTENT_LENGTH).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  projectId: z.uuid().optional(),
  parentId: taskIdOrNumber.optional(),
  context: contextEnum.optional(),
  labels: z.array(labelNameSchema).optional(),
  recurrenceRule: recurrenceRuleSchema,
  startOffsetDays: z.number().int().min(0).optional(),
  anchorDate: z.string(),
  enabled: z.boolean().optional(),
})

export const updateRecurringTaskTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z
    .string()
    .max(MAX_MARKDOWN_CONTENT_LENGTH)
    .nullable()
    .optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  parentId: taskIdOrNumber.nullable().optional(),
  context: contextEnum.optional(),
  labels: z.array(labelNameSchema).optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
  startOffsetDays: z.number().int().min(0).nullable().optional(),
  anchorDate: z.string().optional(),
  enabled: z.boolean().optional(),
})

export const listRecurringTaskTemplatesQuerySchema = z.object({
  context: contextEnum.optional(),
  enabled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})
