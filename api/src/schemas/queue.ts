import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'

export const queueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const putQueueItemsSchema = z.object({
  taskIds: z.array(taskIdOrNumber),
  date: queueDateSchema,
})
