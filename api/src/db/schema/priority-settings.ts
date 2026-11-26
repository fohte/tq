import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const prioritySettings = pgTable(
  'priority_settings',
  {
    id: bigint('id', { mode: 'number' })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
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
    check('priority_settings_name_check', sql`${table.name} <> ''`),
    unique('priority_settings_priority_unique')
      .on(table.priority)
      .nullsNotDistinct(),
    uniqueIndex('priority_settings_sort_order_unique').on(table.sortOrder),
  ],
)
