import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  url: text('url').notNull().unique(),
  secret: text('secret').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
