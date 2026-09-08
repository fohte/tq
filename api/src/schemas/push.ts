import { z } from 'zod'

import { contextEnum } from '#schemas/task'

// Mirrors the browser's `PushSubscription.toJSON()` so a client can post the
// subscription as-is, plus the device it came from: a label naming it and the
// context the machine is set to.
export const createPushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  label: z.string().min(1).optional(),
  context: contextEnum,
})

export const pushEndpointSchema = z.object({
  endpoint: z.url(),
})
