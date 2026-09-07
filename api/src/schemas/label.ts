import { z } from 'zod'

import { labelNameSchema } from '#schemas/label-name'
import { contextEnum } from '#schemas/task'

export const listLabelsQuerySchema = z.object({
  context: contextEnum.optional(),
})

export const updateLabelSchema = z.object({
  name: labelNameSchema.optional(),
  context: contextEnum.optional(),
})
