import { zValidator } from '@hono/zod-validator'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { webhookSubscriptions } from '#db/schema'
import {
  createWebhookSubscriptionSchema,
  webhookSubscriptionIdSchema,
} from '#schemas/webhook'

function webhookSubscriptionToResponse(
  subscription: typeof webhookSubscriptions.$inferSelect,
) {
  return {
    id: subscription.id,
    url: subscription.url,
    createdAt: subscription.createdAt.toISOString(),
  }
}

export const webhooksApp = new Hono()
  .post('/', zValidator('json', createWebhookSubscriptionSchema), async (c) => {
    const input = c.req.valid('json')
    const [created] = await db
      .insert(webhookSubscriptions)
      .values(input)
      .onConflictDoUpdate({
        target: webhookSubscriptions.url,
        set: { secret: input.secret },
      })
      .returning()

    if (!created) {
      return c.json({ error: 'Failed to create webhook subscription' }, 500)
    }

    return c.json(webhookSubscriptionToResponse(created), 201)
  })
  .get('/', async (c) => {
    const subscriptions = await db
      .select()
      .from(webhookSubscriptions)
      .orderBy(
        asc(webhookSubscriptions.createdAt),
        asc(webhookSubscriptions.id),
      )

    return c.json(subscriptions.map(webhookSubscriptionToResponse), 200)
  })
  .delete(
    '/:id',
    zValidator('param', webhookSubscriptionIdSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const [deleted] = await db
        .delete(webhookSubscriptions)
        .where(eq(webhookSubscriptions.id, id))
        .returning({ id: webhookSubscriptions.id })

      if (!deleted) {
        return c.json({ error: 'Webhook subscription not found' }, 404)
      }

      return c.body(null, 204)
    },
  )
