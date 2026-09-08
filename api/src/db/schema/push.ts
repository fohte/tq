import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// One row per browser that granted notification permission. The push
// service's endpoint URL identifies the subscription, so a browser
// re-subscribing the same device updates its row instead of adding one.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  // Device name derived from the User-Agent by the subscribing client, to
  // tell subscriptions apart when several devices are registered.
  label: text('label'),
  // Which machine this is, mirroring the per-machine context the web app keeps
  // client-side: a notification only reaches the devices of its own context.
  context: text('context', { enum: ['work', 'personal'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
})
