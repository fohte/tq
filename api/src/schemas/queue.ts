import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { queueDateSchema } from '#schemas/queue-date'
import { contextEnum } from '#schemas/task'

export { queueDateSchema } from '#schemas/queue-date'

export const putQueueItemsSchema = z.object({
  taskIds: z.array(taskIdOrNumber),
  date: queueDateSchema,
})

export const carryOverQueueItemsSchema = z.object({
  date: queueDateSchema,
})

export const getQueueItemsQuerySchema = z.object({
  date: queueDateSchema,
  context: contextEnum.optional(),
})
