import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const prioritySettings = pgTable(
  'priority_settings',
  {
    priority: integer('priority'),
    name: text('name').notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'priority_settings_priority_check',
      sql`${table.priority} IS NULL OR ${table.priority} BETWEEN -1 AND 2`,
    ),
    uniqueIndex('priority_settings_priority_unique')
      .on(table.priority)
      .where(sql`${table.priority} IS NOT NULL`),
    uniqueIndex('priority_settings_inbox_unique')
      .on(table.priority)
      .where(sql`${table.priority} IS NULL`),
    uniqueIndex('priority_settings_sort_order_unique').on(table.sortOrder),
  ],
)
