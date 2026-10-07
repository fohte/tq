import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { tasks } from '#db/schema/core'

export const taskWaits = pgTable(
  'task_waits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    followUpDate: date('follow_up_date', { mode: 'string' }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_task_waits_task_id').on(table.taskId),
    check(
      'task_waits_acknowledged_requires_resolved',
      sql`${table.acknowledgedAt} IS NULL OR ${table.resolvedAt} IS NOT NULL`,
    ),
  ],
)
