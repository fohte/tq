import { z } from 'zod'

import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'
import { contextEnum } from '#schemas/task'

export const memoContextParamsSchema = z.object({
  context: contextEnum.describe('Memo context: work or personal.'),
})

export const updateMemoSchema = z.object({
  content: z
    .string()
    .max(MAX_MARKDOWN_CONTENT_LENGTH)
    .describe('Replacement markdown document.'),
  revision: z
    .number()
    .int()
    .nonnegative()
    .describe('Current revision returned by memo_get.'),
})
