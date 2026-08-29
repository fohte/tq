import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

import { tasks } from '#db/schema/core'

// One row per coding-agent session (e.g. a Claude Code CLI invocation),
// reported by that agent's hook integration. No status column: "running" is
// derived as `endedAt IS NULL AND lastActiveAt` being recent, since a status
// column would go stale forever once a process is killed without a final
// hook firing, while a timestamp just ages visibly instead.
export const agentSessions = pgTable(
  'agent_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    provider: text('provider', { enum: ['claude_code'] }).notNull(),
    sessionId: text('session_id').notNull(),
    // The immediate parent only, not the full ancestor chain: an ancestor is
    // reachable by following this column one hop at a time. Stores the raw
    // session_id the parent reported (not a FK to agentSessions.id) since a
    // delegated/handed-off session's SessionStart can be reported before its
    // parent's own row exists.
    parentSessionId: text('parent_session_id'),
    context: text('context', { enum: ['work', 'personal'] })
      .notNull()
      .default('personal'),
    cwd: text('cwd').notNull(),
    // Read from the transcript by the reporting agent's hook integration, not
    // computed here; overwritten on every report.
    label: text('label'),
    lastMessage: text('last_message'),
    // Set only through the tq UI; hook reports never touch this column, so a
    // human-assigned name survives every subsequent `label` overwrite.
    customLabel: text('custom_label'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    unique('uq_agent_sessions_provider_session_id').on(
      table.provider,
      table.sessionId,
    ),
    index('idx_agent_sessions_last_active_at').on(table.lastActiveAt),
  ],
)

// Join table linking a session to every task it touched. N:N: a session can
// span multiple tasks (e.g. an unrelated fix along the way), and a task
// commonly spans multiple sessions (compact, resuming on another day/machine).
export const taskAgentSessions = pgTable(
  'task_agent_sessions',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    agentSessionId: text('agent_session_id')
      .notNull()
      .references(() => agentSessions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.agentSessionId] }),
    index('idx_task_agent_sessions_task_id').on(table.taskId),
    index('idx_task_agent_sessions_agent_session_id').on(table.agentSessionId),
  ],
)
