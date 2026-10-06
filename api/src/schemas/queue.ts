import { z } from 'zod'

export const queueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const putQueueItemsSchema = z.object({
  taskIds: z.array(z.uuid()),
  date: queueDateSchema,
})

export const carryOverQueueItemsSchema = z.object({
  date: queueDateSchema,
})
