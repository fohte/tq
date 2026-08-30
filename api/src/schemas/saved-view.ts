import { z } from 'zod'

import { contextEnum } from '#schemas/task'

export const createSavedViewSchema = z.object({
  name: z.string().min(1),
  query: z.string().min(1),
  position: z.number().int().optional(),
  context: contextEnum.optional(),
})

export const updateSavedViewSchema = z.object({
  name: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  position: z.number().int().optional(),
  context: contextEnum.optional(),
})

export const listSavedViewsQuerySchema = z.object({
  context: contextEnum.optional(),
})
