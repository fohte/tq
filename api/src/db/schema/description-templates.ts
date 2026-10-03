import { sql } from 'drizzle-orm'
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const taskDescriptionTemplates = pgTable(
  'task_description_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    whenToUse: text('when_to_use').notNull(),
    body: text('body').notNull(),
    guide: text('guide').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('task_description_templates_default_unique')
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true`),
  ],
)
