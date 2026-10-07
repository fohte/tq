import { z } from 'zod'

export const createTaskWaitSchema = z.object({
  body: z.string().min(1),
  followUpDate: z.iso.date().optional(),
})

export const updateTaskWaitSchema = z
  .object({
    body: z.string().min(1).optional(),
    followUpDate: z.iso.date().optional(),
  })
  .refine(
    (input) => input.body !== undefined || input.followUpDate !== undefined,
    'At least one field must be provided',
  )
