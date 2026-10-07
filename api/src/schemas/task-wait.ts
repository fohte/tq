import { z } from 'zod'

import { timezoneOffsetMinutesSchema } from '#schemas/timezone'

export const createTaskWaitFieldsSchema = z.object({
  body: z.string().min(1),
  followUpDate: z.iso.date().optional(),
})

export const createTaskWaitSchema = createTaskWaitFieldsSchema.extend({
  tzOffset: timezoneOffsetMinutesSchema.optional(),
})

export const updateTaskWaitFieldsSchema = z.object({
  body: z.string().min(1).optional(),
  followUpDate: z.iso.date().optional(),
})

export const updateTaskWaitSchema = updateTaskWaitFieldsSchema.refine(
  (input) => input.body !== undefined || input.followUpDate !== undefined,
  'At least one field must be provided',
)
