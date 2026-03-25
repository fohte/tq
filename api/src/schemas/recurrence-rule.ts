import { z } from 'zod'

export const recurrenceRuleSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval: z.number().int().positive(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
})

export type RecurrenceRuleInput = z.infer<typeof recurrenceRuleSchema>
