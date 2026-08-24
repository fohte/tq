import { zValidator } from '@hono/zod-validator'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { agentSessions, taskAgentSessions, tasks } from '#db/schema'
import {
  updateAgentSessionSchema,
  upsertAgentSessionSchema,
} from '#schemas/agent-session'
import { taskSummaryColumns } from '#services/task-links'

export function agentSessionToResponse(
  session: typeof agentSessions.$inferSelect,
) {
  return {
    id: session.id,
    provider: session.provider,
    sessionId: session.sessionId,
    context: session.context,
    cwd: session.cwd,
    label: session.label,
    lastMessage: session.lastMessage,
    customLabel: session.customLabel,
    startedAt: session.startedAt.toISOString(),
    lastActiveAt: session.lastActiveAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
  }
}

export const agentSessionsApp = new Hono()
  .post('/', zValidator('json', upsertAgentSessionSchema), async (c) => {
    const input = c.req.valid('json')
    const now = new Date()

    const [session] = await db
      .insert(agentSessions)
      .values({
        provider: input.provider,
        sessionId: input.sessionId,
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
          ...(input.context != null ? { context: input.context } : {}),
        },
      })
      .returning()

    if (!session) {
      return c.json({ error: 'Failed to upsert agent session' }, 500)
    }

    return c.json(agentSessionToResponse(session), 200)
  })
  .get('/', async (c) => {
    const result = await db
      .select()
      .from(agentSessions)
      .orderBy(desc(agentSessions.lastActiveAt))

    return c.json(result.map(agentSessionToResponse), 200)
  })
  .get('/by-task', async (c) => {
    const rows = await db
      .select({ taskId: taskAgentSessions.taskId, session: agentSessions })
      .from(taskAgentSessions)
      .innerJoin(
        agentSessions,
        eq(taskAgentSessions.agentSessionId, agentSessions.id),
      )
      .orderBy(desc(agentSessions.lastActiveAt))

    return c.json(
      rows.map((row) => ({
        taskId: row.taskId,
        ...agentSessionToResponse(row.session),
      })),
      200,
    )
  })
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

    const [session] = await db
      .update(agentSessions)
      .set({ customLabel: input.customLabel })
      .where(eq(agentSessions.id, id))
      .returning()

    if (!session) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    return c.json(agentSessionToResponse(session), 200)
  })
  // Resolves tq's internal id from the (provider, session_id) pair a hook
  // integration knows about, e.g. Claude Code's session_id — the only
  // identifier `tq link`/`tq unlink` has on hand at runtime.
  .get('/by-session/:provider/:sessionId', async (c) => {
    const provider = c.req.param('provider')
    if (provider !== 'claude_code') {
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
