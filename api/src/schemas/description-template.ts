import { z } from 'zod'

import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'

export const descriptionTemplateParamsSchema = z.object({
  name: z.string().min(1),
})

export const createDescriptionTemplateSchema = z.object({
  name: z.string().min(1),
  whenToUse: z.string(),
  body: z.string().max(MAX_MARKDOWN_CONTENT_LENGTH),
  guide: z.string(),
  isDefault: z.boolean().optional(),
})

export const updateDescriptionTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  whenToUse: z.string().optional(),
  body: z.string().max(MAX_MARKDOWN_CONTENT_LENGTH).optional(),
  guide: z.string().optional(),
  isDefault: z.boolean().optional(),
})
