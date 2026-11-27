import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { tasks } from '#db/schema/core'
import { projectFieldOptions, projectFields } from '#db/schema/project-fields'

export const taskFieldValues = pgTable(
  'task_field_values',
  {
    taskId: text('task_id').notNull(),
    projectId: text('project_id').notNull(),
    fieldId: uuid('field_id').notNull(),
    optionId: uuid('option_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.fieldId] }),
    index('idx_task_field_values_project_id').on(table.projectId),
    index('idx_task_field_values_field_project_task').on(
      table.fieldId,
      table.projectId,
      table.taskId,
    ),
    index('idx_task_field_values_option_field_task').on(
      table.optionId,
      table.fieldId,
      table.taskId,
    ),
    foreignKey({
      columns: [table.taskId, table.projectId],
      foreignColumns: [tasks.id, tasks.projectId],
      name: 'fk_task_field_values_task_project',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.fieldId, table.projectId],
      foreignColumns: [projectFields.id, projectFields.projectId],
      name: 'fk_task_field_values_field_project',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.optionId, table.fieldId],
      foreignColumns: [projectFieldOptions.id, projectFieldOptions.fieldId],
      name: 'fk_task_field_values_option_field',
    }).onDelete('cascade'),
  ],
)
