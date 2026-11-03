import { z } from 'zod'

const priorityValues = [-1, 0, 1, 2] as const

const prioritySettingSchema = z.object({
  priority: z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.null(),
  ]),
  name: z.string().min(1),
  description: z.string(),
  sortOrder: z.number().int().min(0).max(4),
})

export const prioritySettingsSchema = z.array(prioritySettingSchema)

export const updatePrioritySettingsSchema = prioritySettingsSchema
  .length(5)
  .superRefine((settings, ctx) => {
    const priorities = settings.map(({ priority }) => priority)
    const sortOrders = settings.map(({ sortOrder }) => sortOrder)
    if (new Set(priorities.map((priority) => priority ?? 'inbox')).size !== 5) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each priority must appear once',
      })
    }
    if (new Set(sortOrders).size !== 5) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each sort order must appear once',
      })
    }
    if (!priorityValues.every((priority) => priorities.includes(priority))) {
      ctx.addIssue({
        code: 'custom',
        message: 'All fixed priorities are required',
      })
    }
    if (!priorities.includes(null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'The Inbox priority is required',
      })
    }
  })

export type PrioritySetting = z.infer<typeof prioritySettingSchema>
