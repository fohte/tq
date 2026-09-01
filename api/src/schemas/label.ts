import { z } from 'zod'

import { contextEnum } from '#schemas/task'

export const listLabelsQuerySchema = z.object({
  context: contextEnum.optional(),
})
