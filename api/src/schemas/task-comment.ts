import { z } from 'zod'

import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'

export const createCommentSchema = z.object({
  content: z.string().min(1).max(MAX_MARKDOWN_CONTENT_LENGTH),
})

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(MAX_MARKDOWN_CONTENT_LENGTH),
})
