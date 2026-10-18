import { z } from 'zod'

import { createTaskResponseSchema } from '#schemas/task-response'

export const githubLinkLookupQuerySchema = z.object({
  url: z.string().min(1),
})

export const githubLinkLookupTaskResponseSchema = createTaskResponseSchema.omit(
  { linkSync: true },
)

export const githubLinkLookupResponseSchema = z.object({
  task: githubLinkLookupTaskResponseSchema.nullable(),
})
