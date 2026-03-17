import type { AnyPgColumn } from 'drizzle-orm/pg-core'
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

export const projects = pgTable(
  'tq_projects',
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
  ],
)

export const recurrenceRules = pgTable('tq_recurrence_rules', {
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
  'tq_tasks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', {
      enum: ['todo', 'in_progress', 'completed'],
    })
      .notNull()
      .default('todo'),
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
      enum: ['work', 'personal', 'dev'],
    })
      .notNull()
      .default('personal'),
    sortOrder: integer('sort_order').notNull().default(0),
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
  ],
)

export const labels = pgTable('tq_labels', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const taskLabels = pgTable(
  'tq_task_labels',
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
  'tq_time_blocks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
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
  'tq_schedules',
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
      enum: ['work', 'personal', 'dev'],
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

export const todayTasks = pgTable('tq_today_tasks', {
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

export const taskPages = pgTable(
  'tq_task_pages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_task_pages_task_id').on(table.taskId)],
)

export const taskComments = pgTable(
  'tq_task_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_task_comments_task_id').on(table.taskId),
    index('idx_task_comments_created_at').on(table.taskId, table.createdAt),
  ],
)

export const images = pgTable(
  'tq_images',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    r2Key: text('r2_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_images_r2_key').on(table.r2Key)],
)

export const oauthTokens = pgTable('tq_oauth_tokens', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text('provider').notNull().default('google_calendar'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
