import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { tasks } from '#db/schema/core'
import { taskGithubLinks } from '#db/schema/integrations'

export const taskWaits = pgTable(
  'task_waits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    body: text('body'),
    followUpDate: date('follow_up_date', { mode: 'string' }).notNull(),
    githubLinkId: text('github_link_id').references(() => taskGithubLinks.id, {
      onDelete: 'cascade',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_task_waits_task_id').on(table.taskId),
    uniqueIndex('uq_task_waits_github_link_id').on(table.githubLinkId),
    check(
      'task_waits_body_or_github_link_check',
      sql`${table.body} IS NOT NULL OR ${table.githubLinkId} IS NOT NULL`,
    ),
    check(
      'task_waits_acknowledged_requires_resolved',
      sql`${table.acknowledgedAt} IS NULL OR ${table.resolvedAt} IS NOT NULL`,
    ),
  ],
)
