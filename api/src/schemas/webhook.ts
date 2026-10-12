import { z } from 'zod'

import { taskStatus, taskStatusReason } from '#schemas/task'

export const createWebhookSubscriptionSchema = z.object({
  url: z
    .url()
    .refine((url) => ['http:', 'https:'].includes(new URL(url).protocol), {
      message: 'URL must use HTTP or HTTPS',
    }),
  secret: z.string().min(1),
})

export const webhookSubscriptionIdSchema = z.object({ id: z.uuid() })

export const taskStatusChangedWebhookEventSchema = z.object({
  event: z.literal('task.status_changed'),
  task: z.object({
    id: z.string(),
    number: z.number().int(),
    status: taskStatus,
    statusReason: taskStatusReason.nullable(),
    duplicateOfTask: z
      .object({
        id: z.string(),
        number: z.number().int(),
        title: z.string(),
      })
      .optional(),
  }),
})

export type TaskStatusChangedWebhookEvent = z.output<
  typeof taskStatusChangedWebhookEventSchema
>
