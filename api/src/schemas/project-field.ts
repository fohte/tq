import { z } from 'zod'

const fieldNameSchema = z.string().trim().min(1)

export const projectIdParamSchema = z.object({ projectId: z.string().min(1) })
export const projectFieldParamSchema = projectIdParamSchema.extend({
  fieldId: z.uuid(),
})
export const projectFieldOptionParamSchema = projectFieldParamSchema.extend({
  optionId: z.uuid(),
})

export const createProjectFieldSchema = z.object({
  name: fieldNameSchema,
  type: z.literal('single_select').optional(),
  options: z.array(fieldNameSchema).optional(),
})

export const updateProjectFieldSchema = z.object({ name: fieldNameSchema })
export const createProjectFieldOptionSchema = z.object({
  name: fieldNameSchema,
})
export const updateProjectFieldOptionSchema = createProjectFieldOptionSchema
