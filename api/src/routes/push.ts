import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { pushSubscriptions } from '#db/schema'
import { VAPID_PUBLIC_KEY } from '#env'
import { createPushSubscriptionSchema, pushEndpointSchema } from '#schemas/push'
import { isPushConfigured, sendPush } from '#services/push'

function subscriptionToResponse(
  subscription: typeof pushSubscriptions.$inferSelect,
) {
  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
    label: subscription.label,
    context: subscription.context,
    createdAt: subscription.createdAt.toISOString(),
    lastSuccessAt: subscription.lastSuccessAt?.toISOString() ?? null,
  }
}

export const pushApp = new Hono()
  // The web app is served by a static nginx image with no build-time env, so
  // it reads the application server key from here rather than from its bundle.
  .get('/vapid-public-key', (c) => {
    if (!isPushConfigured()) {
      return c.json({ error: 'Push notifications are not configured' }, 503)
    }

    return c.json({ publicKey: VAPID_PUBLIC_KEY }, 200)
  })
  .post(
    '/subscriptions',
    zValidator('json', createPushSubscriptionSchema),
    async (c) => {
      const input = c.req.valid('json')
      // An omitted label leaves the stored one alone: a client that posts
      // `PushSubscription.toJSON()` as-is carries no label.
      const label = input.label == null ? {} : { label: input.label }

      // Clients re-subscribe on every startup because a browser can rotate the
      // keys of an endpoint it already handed out.
      const [subscription] = await db
        .insert(pushSubscriptions)
        .values({
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          context: input.context,
          ...label,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
            context: input.context,
            ...label,
          },
        })
        .returning()

      if (!subscription) {
        return c.json({ error: 'Failed to save push subscription' }, 500)
      }

      return c.json(subscriptionToResponse(subscription), 200)
    },
  )
  // Idempotent: a client unsubscribing a subscription that was already dropped
  // as gone (see #services/push) is not an error.
  .delete(
    '/subscriptions',
    zValidator('json', pushEndpointSchema),
    async (c) => {
      const { endpoint } = c.req.valid('json')

      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))

      return c.body(null, 204)
    },
  )
  // Takes the caller's own endpoint rather than fanning out: a test send is
  // about the device in front of you, and the other machine should stay quiet.
  .post('/test', zValidator('json', pushEndpointSchema), async (c) => {
    if (!isPushConfigured()) {
      return c.json({ error: 'Push notifications are not configured' }, 503)
    }

    const { endpoint } = c.req.valid('json')
    const report = await sendPush(
      { endpoint },
      { title: 'tq', body: 'Test notification' },
    )

    return c.json(report, 200)
  })
