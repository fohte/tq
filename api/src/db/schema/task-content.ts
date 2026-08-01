import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

import { tasks } from '#db/schema/core'

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

// Status changes and GitHub link/unlink events for a task's activity
// timeline. Deliberately separate from `edits`: that table's `DISTINCT ON`
// "latest author per target" queries (see `lib/edits.ts`) assume one row
// shape per target, which a mix of these event kinds would break.
export const taskEvents = pgTable(
  'task_events',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['status_changed', 'github_linked', 'github_unlinked'],
    }).notNull(),
    fromStatus: text('from_status', {
      enum: ['todo', 'in_progress', 'completed'],
    }),
    toStatus: text('to_status', {
      enum: ['todo', 'in_progress', 'completed'],
    }),
    githubOwner: text('github_owner'),
    githubRepo: text('github_repo'),
    githubNumber: integer('github_number'),
    githubKind: text('github_kind', { enum: ['issue', 'pull_request'] }),
    authorKind: text('author_kind', {
      enum: ['human', 'llm', 'system'],
    }).notNull(),
    authorAgent: text('author_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'task_events_type_check',
      sql`${table.type} IN ('status_changed', 'github_linked', 'github_unlinked')`,
    ),
    // `status_changed` carries fromStatus/toStatus and no GitHub columns;
    // `github_linked`/`github_unlinked` carry all four GitHub columns and no
    // status columns.
    check(
      'task_events_payload_check',
      sql`(${table.type} = 'status_changed'
          AND ${table.fromStatus} IS NOT NULL AND ${table.toStatus} IS NOT NULL
          AND ${table.githubOwner} IS NULL AND ${table.githubRepo} IS NULL
          AND ${table.githubNumber} IS NULL AND ${table.githubKind} IS NULL)
        OR (${table.type} IN ('github_linked', 'github_unlinked')
          AND ${table.fromStatus} IS NULL AND ${table.toStatus} IS NULL
          AND ${table.githubOwner} IS NOT NULL AND ${table.githubRepo} IS NOT NULL
          AND ${table.githubNumber} IS NOT NULL AND ${table.githubKind} IS NOT NULL)`,
    ),
    check(
      'task_events_author_kind_check',
      sql`${table.authorKind} IN ('human', 'llm', 'system')`,
    ),
    check(
      'task_events_author_agent_required_for_llm',
      sql`(${table.authorKind} = 'llm') = (${table.authorAgent} IS NOT NULL)`,
    ),
    index('idx_task_events_task_id_created_at').on(
      table.taskId,
      table.createdAt,
    ),
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
