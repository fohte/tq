import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { contextEnum } from '#schemas/task'

export const queueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const putQueueItemsSchema = z.object({
  taskIds: z.array(taskIdOrNumber),
  date: queueDateSchema,
})

export const carryOverQueueItemsSchema = z.object({
  date: queueDateSchema,
})

export const getQueueItemsQuerySchema = z
  .object({
    date: queueDateSchema.optional(),
    from: queueDateSchema.optional(),
    to: queueDateSchema.optional(),
    context: contextEnum.optional(),
  })
  .superRefine(({ date, from, to }, ctx) => {
    if (date != null && (from != null || to != null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Use either date or from and to',
        path: ['date'],
      })
      return
    }

    if (date == null && (from == null || to == null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide date or both from and to',
        path: from == null ? ['from'] : ['to'],
      })
      return
    }

    if (from != null && to != null && from > to) {
      ctx.addIssue({
        code: 'custom',
        message: 'from must be less than or equal to to',
        path: ['to'],
      })
    }
  })
