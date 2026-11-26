import { sql } from 'drizzle-orm'
import {
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { projects } from '#db/schema/core'

export const projectFields = pgTable(
  'project_fields',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull().default('single_select'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_project_fields_project_id_name').on(table.projectId, table.name),
    unique('uq_project_fields_id_project_id').on(table.id, table.projectId),
    check('project_fields_type_check', sql`${table.type} = 'single_select'`),
  ],
)

export const projectFieldOptions = pgTable(
  'project_field_options',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => projectFields.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_project_field_options_field_id_name').on(
      table.fieldId,
      table.name,
    ),
    unique('uq_project_field_options_id_field_id').on(table.id, table.fieldId),
  ],
)
