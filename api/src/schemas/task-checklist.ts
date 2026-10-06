import { z } from 'zod'

const itemContent = z
  .string()
  .min(1)
  .refine((content) => !/[\r\n]/.test(content), {
    message: 'content must be a single line',
  })

export const createChecklistSchema = z.object({
  name: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export const updateChecklistSchema = z.object({
  name: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export const createChecklistItemSchema = z.object({
  content: itemContent,
  note: z.string().nullable().optional(),
  github: z.string().min(1).optional(),
  parentItemId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export const updateChecklistItemSchema = z.object({
  content: itemContent.optional(),
  note: z.string().nullable().optional(),
  github: z.string().min(1).optional(),
})

export const moveChecklistItemSchema = z.object({
  parentItemId: z.string().nullable().optional(),
  afterItemId: z.string().nullable().optional(),
})
