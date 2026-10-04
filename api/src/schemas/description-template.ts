import { z } from 'zod'

import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'
import { pathSegmentSchema } from '#operations/path-segment'

const descriptionTemplateNameSchema = pathSegmentSchema(
  'Description template name',
)

export const descriptionTemplateParamsSchema = z.object({
  name: descriptionTemplateNameSchema,
})

export const createDescriptionTemplateSchema = z.object({
  name: descriptionTemplateNameSchema,
  whenToUse: z.string(),
  body: z.string().max(MAX_MARKDOWN_CONTENT_LENGTH),
  guide: z.string(),
  isDefault: z.boolean().optional(),
})

export const updateDescriptionTemplateSchema = z.object({
  name: descriptionTemplateNameSchema.optional(),
  whenToUse: z.string().optional(),
  body: z.string().max(MAX_MARKDOWN_CONTENT_LENGTH).optional(),
  guide: z.string().optional(),
  isDefault: z.boolean().optional(),
})
