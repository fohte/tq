import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const memos = pgTable('memos', {
  context: text('context', { enum: ['work', 'personal'] }).primaryKey(),
  content: text('content').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
