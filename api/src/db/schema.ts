import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

export * from '#db/schema/integrations'

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

export const labels = pgTable('labels', {
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

export const taskPages = pgTable(
  'task_pages',
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
  'task_comments',
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

// Directed mention link (source task's body text -> `#<target number>`),
// derived from description/page/comment content by
// `services/task-links.ts#syncTaskLinks` and re-synced on every body write.
export const taskLinks = pgTable(
  'task_links',
  {
    sourceTaskId: text('source_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    targetTaskId: text('target_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceTaskId, table.targetTaskId] }),
    index('idx_task_links_target_task_id').on(table.targetTaskId),
    check(
      'task_links_no_self_link',
      sql`${table.sourceTaskId} != ${table.targetTaskId}`,
    ),
  ],
)

export const edits = pgTable(
  'edits',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    pageId: text('page_id').references(() => taskPages.id, {
      onDelete: 'cascade',
    }),
    commentId: text('comment_id').references(() => taskComments.id, {
      onDelete: 'cascade',
    }),
    action: text('action', { enum: ['create', 'update'] }).notNull(),
    field: text('field', {
      enum: ['title', 'description', 'content'],
    }),
    authorKind: text('author_kind', {
      enum: ['human', 'llm', 'system'],
    }).notNull(),
    authorAgent: text('author_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('edits_action_check', sql`${table.action} IN ('create', 'update')`),
    // `create` never carries a field (it means the whole record); `update`
    // always names the field that changed.
    check(
      'edits_action_field_check',
      sql`(${table.action} = 'create' AND ${table.field} IS NULL) OR (${table.action} = 'update' AND ${table.field} IS NOT NULL)`,
    ),
    // Which field names are valid depends on what's being edited: tasks have
    // title/description, pages have title/content, comments have only content.
    check(
      'edits_field_target_check',
      sql`${table.field} IS NULL
        OR (${table.pageId} IS NULL AND ${table.commentId} IS NULL AND ${table.field} IN ('title', 'description'))
        OR (${table.pageId} IS NOT NULL AND ${table.field} IN ('title', 'content'))
        OR (${table.commentId} IS NOT NULL AND ${table.field} = 'content')`,
    ),
    check(
      'edits_target_exclusive_check',
      sql`NOT (${table.pageId} IS NOT NULL AND ${table.commentId} IS NOT NULL)`,
    ),
    check(
      'edits_author_kind_check',
      sql`${table.authorKind} IN ('human', 'llm', 'system')`,
    ),
    check(
      'edits_author_agent_required_for_llm',
      sql`(${table.authorKind} = 'llm') = (${table.authorAgent} IS NOT NULL)`,
    ),
    index('idx_edits_task_id_created_at').on(table.taskId, table.createdAt),
    index('idx_edits_page_id')
      .on(table.pageId)
      .where(sql`${table.pageId} IS NOT NULL`),
    index('idx_edits_comment_id')
      .on(table.commentId)
      .where(sql`${table.commentId} IS NOT NULL`),
  ],
)

export const images = pgTable(
  'images',
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

export const taskGithubLinks = pgTable(
  'task_github_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id')
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    number: integer('number').notNull(),
    kind: text('kind', { enum: ['issue', 'pull_request'] }).notNull(),
    url: text('url').notNull(),
    state: text('state', { enum: ['open', 'closed', 'merged'] }).notNull(),
    title: text('title').notNull(),
    // `title`/`body`/`state` hold the GitHub values as of the last sync, not
    // the task's current values — the sync diffs a fresh fetch against these
    // to tell "GitHub changed" apart from "the task was edited in TQ".
    body: text('body'),
    // GitHub's ETag for the last fetch of this issue/PR, sent back as
    // `If-None-Match` on the next sync so an unchanged resource costs a bare
    // 304 instead of a full fetch (and doesn't count against GitHub's
    // primary rate limit).
    etag: text('etag'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // At most one task may link to a given issue/PR.
    unique('uq_task_github_links_repo_number').on(
      table.owner,
      table.repo,
      table.number,
    ),
    // Only a pull request can be merged; a plain issue's state is always
    // open or closed.
    check(
      'task_github_links_state_kind_check',
      sql`${table.kind} = 'pull_request' OR ${table.state} <> 'merged'`,
    ),
  ],
)
