import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const projects = pgTable(
  'projects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', {
      enum: ['active', 'paused', 'completed', 'archived'],
    })
      .notNull()
      .default('active'),
    startDate: date('start_date'),
    targetDate: date('target_date'),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    context: text('context', {
      enum: ['work', 'personal'],
    })
      .notNull()
      .default('personal'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_projects_status').on(table.status),
    index('idx_projects_sort_order').on(table.sortOrder),
    index('idx_projects_context').on(table.context),
  ],
)

export const recurrenceRules = pgTable('recurrence_rules', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text('type', {
    enum: ['daily', 'weekly', 'monthly', 'custom'],
  }).notNull(),
  interval: integer('interval').notNull().default(1),
  daysOfWeek: integer('days_of_week').array(),
  dayOfMonth: integer('day_of_month'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const tasks = pgTable(
  'tasks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Globally unique, human-facing sequential id (e.g. `#123`) for display
    // and URL lookup; the UUID `id` remains the primary key used internally
    // and in FKs. `generatedAlwaysAsIdentity` (rather than `serial`) makes
    // Postgres reject any insert that tries to set this explicitly, keeping
    // assigned numbers immutable.
    number: integer('number').notNull().generatedAlwaysAsIdentity().unique(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', {
      enum: ['todo', 'completed'],
    })
      .notNull()
      .default('todo'),
    statusReason: text('status_reason', {
      enum: ['completed', 'not_planned', 'duplicate'],
    }),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    estimatedMinutes: integer('estimated_minutes'),
    parentId: text('parent_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'set null',
    }),
    projectId: text('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    recurrenceRuleId: text('recurrence_rule_id').references(
      () => recurrenceRules.id,
      { onDelete: 'set null' },
    ),
    context: text('context', {
      enum: ['work', 'personal'],
    })
      .notNull()
      .default('personal'),
    // GTD-style commitment: `inbox` = not triaged, `someday` = deferred,
    // `active` = committed.
    commitment: text('commitment', {
      enum: ['inbox', 'active', 'someday'],
    })
      .notNull()
      .default('inbox'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_tasks_parent_id').on(table.parentId),
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_start_date').on(table.startDate),
    index('idx_tasks_due_date').on(table.dueDate),
    index('idx_tasks_project_id').on(table.projectId),
    index('idx_tasks_project_status').on(table.projectId, table.status),
    index('idx_tasks_commitment').on(table.commitment),
    check(
      'tasks_status_reason_check',
      sql`${table.status} = 'completed' OR ${table.statusReason} IS NULL`,
    ),
  ],
)

export const labels = pgTable(
  'labels',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull().unique(),
    color: text('color'),
    context: text('context', {
      enum: ['work', 'personal'],
    })
      .notNull()
      .default('personal'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_labels_context').on(table.context)],
)

export const taskLabels = pgTable(
  'task_labels',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.labelId] }),
    index('idx_task_labels_task_id').on(table.taskId),
    index('idx_task_labels_label_id').on(table.labelId),
  ],
)

export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    isAutoScheduled: boolean('is_auto_scheduled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_time_blocks_task_id').on(table.taskId),
    index('idx_time_blocks_date_range').on(table.startTime, table.endTime),
  ],
)

export const schedules = pgTable(
  'schedules',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    recurrenceRuleId: text('recurrence_rule_id').references(
      () => recurrenceRules.id,
      { onDelete: 'set null' },
    ),
    context: text('context', {
      enum: ['work', 'personal'],
    })
      .notNull()
      .default('personal'),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_schedules_recurrence_rule_id').on(table.recurrenceRuleId),
    index('idx_schedules_context').on(table.context),
  ],
)

export const todayTasks = pgTable('today_tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const savedViews = pgTable(
  'saved_views',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    // The raw search DSL string (see `#search-query-parser`), not a parsed
    // structure, so extending the DSL never requires a migration here.
    query: text('query').notNull(),
    position: integer('position').notNull().default(0),
    context: text('context', {
      enum: ['work', 'personal'],
    })
      .notNull()
      .default('personal'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_saved_views_context').on(table.context),
    index('idx_saved_views_position').on(table.position),
  ],
)
