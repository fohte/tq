import { z } from 'zod'

import { contextEnum } from '#schemas/task'

export const listLabelsQuerySchema = z.object({
  context: contextEnum.optional(),
})

export const updateLabelSchema = z.object({
  name: z.string().min(1).optional(),
  context: contextEnum.optional(),
})
