import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

import { labels, projects, recurrenceRules, tasks } from '#db/schema/core'

export const recurringTaskTemplates = pgTable(
  'recurring_task_templates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    description: text('description'),
    estimatedMinutes: integer('estimated_minutes'),
    projectId: text('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    // Task under which each generated instance is nested, not another
    // template -- a template has no parent/child hierarchy of its own.
    parentId: text('parent_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    context: text('context', {
      enum: ['work', 'personal'],
    })
      .notNull()
      .default('personal'),
    // Owned exclusively by this template (never shared with a task or
    // another template), so it can be updated/deleted in place without the
    // shared-reference checks `tasks`' recurrence rule handling needs.
    recurrenceRuleId: text('recurrence_rule_id')
      .notNull()
      .references(() => recurrenceRules.id),
    // Days before the due date to place the generated instance's start
    // date; null means the generated instance gets no start date.
    startOffsetDays: integer('start_offset_days'),
    // Base date `computeNextDate` seeds the first occurrence from.
    anchorDate: date('anchor_date').notNull(),
    // Date of the most recently generated occurrence, or null if none has
    // been generated yet.
    lastGeneratedDate: date('last_generated_date'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_recurring_task_templates_project_id').on(table.projectId),
    index('idx_recurring_task_templates_parent_id').on(table.parentId),
    index('idx_recurring_task_templates_context').on(table.context),
    index('idx_recurring_task_templates_enabled').on(table.enabled),
    index('idx_recurring_task_templates_recurrence_rule_id').on(
      table.recurrenceRuleId,
    ),
  ],
)

export const recurringTaskTemplateLabels = pgTable(
  'recurring_task_template_labels',
  {
    templateId: text('template_id')
      .notNull()
      .references(() => recurringTaskTemplates.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.templateId, table.labelId] }),
    index('idx_recurring_task_template_labels_template_id').on(
      table.templateId,
    ),
    index('idx_recurring_task_template_labels_label_id').on(table.labelId),
  ],
)
