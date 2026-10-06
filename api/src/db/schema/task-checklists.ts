import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

import { tasks } from '#db/schema/core'
import { taskGithubLinks } from '#db/schema/integrations'

export const taskChecklists = pgTable(
  'task_checklists',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    name: text('name'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_task_checklists_task_id_sort_order').on(
      table.taskId,
      table.sortOrder,
    ),
  ],
)

export const taskChecklistItems = pgTable(
  'task_checklist_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    checklistId: text('checklist_id')
      .notNull()
      .references(() => taskChecklists.id, { onDelete: 'cascade' }),
    parentItemId: text('parent_item_id'),
    content: text('content').notNull(),
    note: text('note'),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    githubLinkId: text('github_link_id').references(() => taskGithubLinks.id, {
      onDelete: 'set null',
    }),
    subtaskId: text('subtask_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_task_checklist_items_id_checklist_id').on(
      table.id,
      table.checklistId,
    ),
    foreignKey({
      columns: [table.parentItemId, table.checklistId],
      foreignColumns: [table.id, table.checklistId],
      name: 'fk_task_checklist_items_parent_same_checklist',
    }).onDelete('cascade'),
    index('idx_task_checklist_items_checklist_id_parent_sort').on(
      table.checklistId,
      table.parentItemId,
      table.sortOrder,
    ),
    index('idx_task_checklist_items_github_link_id')
      .on(table.githubLinkId)
      .where(sql`${table.githubLinkId} IS NOT NULL`),
    index('idx_task_checklist_items_subtask_id')
      .on(table.subtaskId)
      .where(sql`${table.subtaskId} IS NOT NULL`),
    check(
      'task_checklist_items_link_exclusive_check',
      sql`NOT (${table.githubLinkId} IS NOT NULL AND ${table.subtaskId} IS NOT NULL)`,
    ),
  ],
)
