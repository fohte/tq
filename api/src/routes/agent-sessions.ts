import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, gt, inArray, isNull, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { ResultAsync } from 'neverthrow'

import type { DbTransaction } from '#db/connection'
import { db } from '#db/connection'
import { agentSessions, taskAgentSessions, tasks } from '#db/schema'
import { getAgentSessionActiveCriteria } from '#lib/agent-session-activity'
import { setChangeEventTaskIds } from '#lib/change-events'
import type { AgentProvider } from '#schemas/agent-session'
import {
  agentProviderSchema,
  listAgentSessionsByTaskQuerySchema,
  listAgentSessionsQuerySchema,
  updateAgentSessionSchema,
  upsertAgentSessionSchema,
} from '#schemas/agent-session'
import { taskSummaryColumns } from '#services/task-links'

// Claude Code's own `cleanupPeriodDays` setting (default 30 days) already
// deletes the transcript a session would resume from, so a row idle past
// this age can never be resumed regardless of what tq does with it:
// https://code.claude.com/docs/en/settings-reference#cleanupperioddays
const STALE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function parseAgentProvider(value: string): AgentProvider | undefined {
  const parsed = agentProviderSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function findAgentSessionBySessionId(
  tx: DbTransaction,
  provider: AgentProvider,
  sessionId: string,
) {
  return tx.query.agentSessions.findFirst({
    where: and(
      eq(agentSessions.provider, provider),
      eq(agentSessions.sessionId, sessionId),
    ),
  })
}

async function listTaskIdsForSession(
  tx: DbTransaction,
  agentSessionId: string,
): Promise<string[]> {
  const links = await tx
    .select({ taskId: taskAgentSessions.taskId })
    .from(taskAgentSessions)
    .where(eq(taskAgentSessions.agentSessionId, agentSessionId))

  return links.map(({ taskId }) => taskId).sort()
}

export function agentSessionToResponse(
  session: typeof agentSessions.$inferSelect,
) {
  return {
    ...agentSessionSummaryToResponse(session),
    lastMessage: session.lastMessage,
  }
}

const agentSessionSummaryColumns = {
  id: agentSessions.id,
  provider: agentSessions.provider,
  sessionId: agentSessions.sessionId,
  parentSessionId: agentSessions.parentSessionId,
  context: agentSessions.context,
  cwd: agentSessions.cwd,
  label: agentSessions.label,
  customLabel: agentSessions.customLabel,
  startedAt: agentSessions.startedAt,
  lastActiveAt: agentSessions.lastActiveAt,
  endedAt: agentSessions.endedAt,
  archivedAt: agentSessions.archivedAt,
}

type AgentSessionSummary = Pick<
  typeof agentSessions.$inferSelect,
  keyof typeof agentSessionSummaryColumns
>

function agentSessionSummaryToResponse(session: AgentSessionSummary) {
  return {
    id: session.id,
    provider: session.provider,
    sessionId: session.sessionId,
    parentSessionId: session.parentSessionId,
    context: session.context,
    cwd: session.cwd,
    label: session.label,
    customLabel: session.customLabel,
    startedAt: session.startedAt.toISOString(),
    lastActiveAt: session.lastActiveAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    archivedAt: session.archivedAt?.toISOString() ?? null,
  }
}

export const agentSessionsApp = new Hono()
  .post('/', zValidator('json', upsertAgentSessionSchema), async (c) => {
    const input = c.req.valid('json')
    const now = new Date()

    const upserted = await db.transaction(async (tx) => {
      const existing = await findAgentSessionBySessionId(
        tx,
        input.provider,
        input.sessionId,
      )

      const [session] = await tx
        .insert(agentSessions)
        .values({
          provider: input.provider,
          sessionId: input.sessionId,
          parentSessionId: input.parentSessionId ?? null,
          cwd: input.cwd,
          label: input.label,
          lastMessage: input.lastMessage,
          lastActiveAt: now,
          endedAt: input.ended === true ? now : null,
          ...(input.context != null ? { context: input.context } : {}),
        })
        .onConflictDoUpdate({
          target: [agentSessions.provider, agentSessions.sessionId],
          set: {
            cwd: input.cwd,
            label: input.label,
            lastMessage: input.lastMessage,
            lastActiveAt: now,
            // Unconditional, not just set-when-ended: a report without `ended`
            // means the session is active again (e.g. resumed after a prior
            // SessionEnd), which must clear a stale endedAt so the "running"
            // derivation (see schema/agent-sessions.ts) doesn't stay stuck.
            endedAt: input.ended === true ? now : null,
            ...(input.ended === true ? {} : { archivedAt: null }),
            ...(input.context != null ? { context: input.context } : {}),
          },
        })
        .returning()

      // Inherit parent task links on creation only, so later reports never
      // re-add a link the user has since removed.
      if (session && existing == null && input.parentSessionId != null) {
        const parent = await findAgentSessionBySessionId(
          tx,
          input.provider,
          input.parentSessionId,
        )

        if (parent) {
          const parentTasks = await tx
            .select({ taskId: taskAgentSessions.taskId })
            .from(taskAgentSessions)
            .where(eq(taskAgentSessions.agentSessionId, parent.id))

          if (parentTasks.length > 0) {
            await tx
              .insert(taskAgentSessions)
              .values(
                parentTasks.map(({ taskId }) => ({
                  taskId,
                  agentSessionId: session.id,
                })),
              )
              // Concurrent first reports of the same (provider, sessionId)
              // can both resolve `existing == null` before either commits;
              // the loser then retries this insert against the same
              // agent_session_id the winner already created, which would
              // otherwise violate task_agent_sessions's primary key.
              .onConflictDoNothing({
                target: [
                  taskAgentSessions.taskId,
                  taskAgentSessions.agentSessionId,
                ],
              })
          }
        }
      }

      return {
        session,
        taskIds: session ? await listTaskIdsForSession(tx, session.id) : [],
      }
    })

    if (!upserted.session) {
      return c.json({ error: 'Failed to upsert agent session' }, 500)
    }

    // No cron exists to run this on a schedule (see api/src/app.ts), so it
    // piggybacks on every write instead. Isolated from the upsert above: a
    // failure here must not turn an already-successful report into a 500.
    const pruneResult = await ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        const staleSessions = await tx
          .select({ id: agentSessions.id })
          .from(agentSessions)
          .where(
            lt(
              agentSessions.lastActiveAt,
              new Date(now.getTime() - STALE_SESSION_MAX_AGE_MS),
            ),
          )
          .for('update')
        const staleSessionIds = staleSessions.map(({ id }) => id)
        if (staleSessionIds.length === 0) return []

        const taskIds = (
          await tx
            .select({ taskId: taskAgentSessions.taskId })
            .from(taskAgentSessions)
            .where(inArray(taskAgentSessions.agentSessionId, staleSessionIds))
        ).map(({ taskId }) => taskId)

        await tx
          .delete(agentSessions)
          .where(inArray(agentSessions.id, staleSessionIds))

        return taskIds
      }),
      (error) => error,
    )
    if (pruneResult.isErr()) {
      captureWithFingerprint(
        pruneResult.error,
        'api.agent-sessions.prune-failed',
      )
    }

    const taskIds = new Set(upserted.taskIds)
    if (pruneResult.isOk()) {
      for (const taskId of pruneResult.value) taskIds.add(taskId)
    }
    setChangeEventTaskIds(c, [...taskIds].sort())

    return c.json(agentSessionToResponse(upserted.session), 200)
  })
  .get('/', zValidator('query', listAgentSessionsQuerySchema), async (c) => {
    const { sessionId, limit } = c.req.valid('query')

    const query = db
      .select()
      .from(agentSessions)
      .where(
        sessionId ? inArray(agentSessions.sessionId, sessionId) : undefined,
      )
      .orderBy(desc(agentSessions.lastActiveAt))
    const result =
      limit === 'unlimited' ? await query : await query.limit(limit)

    return c.json(result.map(agentSessionToResponse), 200)
  })
  .get(
    '/by-task',
    zValidator('query', listAgentSessionsByTaskQuerySchema),
    async (c) => {
      const { sessionId, taskIds, active, limit } = c.req.valid('query')
      const activeCriteria = getAgentSessionActiveCriteria()

      const query = db
        .select({
          taskId: taskAgentSessions.taskId,
          taskNumber: tasks.number,
          taskTitle: tasks.title,
          taskParentId: tasks.parentId,
          taskStatus: tasks.status,
          linkedAt: taskAgentSessions.linkedAt,
          session: agentSessionSummaryColumns,
        })
        .from(taskAgentSessions)
        .innerJoin(
          agentSessions,
          eq(taskAgentSessions.agentSessionId, agentSessions.id),
        )
        .innerJoin(tasks, eq(taskAgentSessions.taskId, tasks.id))
        .where(
          and(
            sessionId ? inArray(agentSessions.sessionId, sessionId) : undefined,
            taskIds === 'all'
              ? undefined
              : inArray(taskAgentSessions.taskId, taskIds),
            active === 'all'
              ? undefined
              : and(
                  activeCriteria.endedAt === null
                    ? isNull(agentSessions.endedAt)
                    : eq(agentSessions.endedAt, activeCriteria.endedAt),
                  activeCriteria.archivedAt === null
                    ? isNull(agentSessions.archivedAt)
                    : eq(agentSessions.archivedAt, activeCriteria.archivedAt),
                  gt(
                    agentSessions.lastActiveAt,
                    activeCriteria.lastActiveAtAfter,
                  ),
                ),
          ),
        )
        .orderBy(desc(agentSessions.lastActiveAt))
      const rows =
        limit === 'unlimited' ? await query : await query.limit(limit)

      return c.json(
        rows.map((row) => ({
          taskId: row.taskId,
          taskNumber: row.taskNumber,
          taskTitle: row.taskTitle,
          taskParentId: row.taskParentId,
          taskStatus: row.taskStatus,
          linkedAt: row.linkedAt.toISOString(),
          ...agentSessionSummaryToResponse(row.session),
        })),
        200,
      )
    },
  )
  .get('/:id', async (c) => {
    const id = c.req.param('id')

    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, id),
    })
    if (!session) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    return c.json(agentSessionToResponse(session), 200)
  })
  .patch('/:id', zValidator('json', updateAgentSessionSchema), async (c) => {
    const id = c.req.param('id')
    const input = c.req.valid('json')

    const { session, taskIds } = await db.transaction(async (tx) => {
      const taskIds = await listTaskIdsForSession(tx, id)
      const [session] = await tx
        .update(agentSessions)
        .set({ customLabel: input.customLabel })
        .where(eq(agentSessions.id, id))
        .returning()
      return { session, taskIds }
    })

    if (!session) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    setChangeEventTaskIds(c, taskIds)
    return c.json(agentSessionToResponse(session), 200)
  })
  // Resolves tq's internal id from the (provider, session_id) pair a hook
  // integration knows about, e.g. a Claude Code or Codex session_id — the
  // only identifier `tq link`/`tq unlink` has on hand at runtime.
  .get('/by-session/:provider/:sessionId', async (c) => {
    const provider = parseAgentProvider(c.req.param('provider'))
    if (provider === undefined) {
      return c.json({ error: 'Agent session not found' }, 404)
    }
    const sessionId = c.req.param('sessionId')

    const session = await db.query.agentSessions.findFirst({
      where: and(
        eq(agentSessions.provider, provider),
        eq(agentSessions.sessionId, sessionId),
      ),
    })
    if (!session) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    return c.json(agentSessionToResponse(session), 200)
  })
  // Keyed by (provider, session_id), not the internal id used everywhere
  // else in this file: an external session manager only ever knows the
  // former, since it never sees a session until it reports through here.
  .delete('/by-session/:provider/:sessionId', async (c) => {
    const provider = parseAgentProvider(c.req.param('provider'))
    if (provider === undefined) {
      return c.json({ error: 'Agent session not found' }, 404)
    }
    const sessionId = c.req.param('sessionId')

    const deleted = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: agentSessions.id })
        .from(agentSessions)
        .where(
          and(
            eq(agentSessions.provider, provider),
            eq(agentSessions.sessionId, sessionId),
          ),
        )
        .for('update')
      if (!existing) return null

      const taskIds = await listTaskIdsForSession(tx, existing.id)
      const rows = await tx
        .delete(agentSessions)
        .where(eq(agentSessions.id, existing.id))
        .returning()

      return rows.length > 0 ? taskIds : null
    })

    if (deleted == null) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    setChangeEventTaskIds(c, deleted)
    return c.body(null, 204)
  })
  .post('/by-session/:provider/:sessionId/archive', async (c) => {
    const provider = parseAgentProvider(c.req.param('provider'))
    if (provider === undefined) {
      return c.json({ error: 'Agent session not found' }, 404)
    }
    const sessionId = c.req.param('sessionId')

    const { session, taskIds } = await db.transaction(async (tx) => {
      const existing = await findAgentSessionBySessionId(
        tx,
        provider,
        sessionId,
      )
      if (!existing) return { session: undefined, taskIds: [] }

      const taskIds = await listTaskIdsForSession(tx, existing.id)
      const [session] = await tx
        .update(agentSessions)
        .set({ archivedAt: new Date() })
        .where(eq(agentSessions.id, existing.id))
        .returning()

      return { session, taskIds }
    })

    if (!session) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    setChangeEventTaskIds(c, taskIds)
    return c.json(agentSessionToResponse(session), 200)
  })
  .get('/:id/tasks', async (c) => {
    const id = c.req.param('id')

    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, id),
    })
    if (!session) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    const tasksLinked = await db
      .select(taskSummaryColumns)
      .from(taskAgentSessions)
      .innerJoin(tasks, eq(taskAgentSessions.taskId, tasks.id))
      .where(eq(taskAgentSessions.agentSessionId, id))
      .orderBy(tasks.number)

    return c.json(tasksLinked, 200)
  })
