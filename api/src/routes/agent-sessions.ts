import { zValidator } from '@hono/zod-validator'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { agentSessions } from '#db/schema'
import { upsertAgentSessionSchema } from '#schemas/agent-session'

function agentSessionToResponse(session: typeof agentSessions.$inferSelect) {
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
        ...(input.context != null ? { context: input.context } : {}),
        ...(input.ended === true ? { endedAt: now } : {}),
      })
      .onConflictDoUpdate({
        target: [agentSessions.provider, agentSessions.sessionId],
        set: {
          cwd: input.cwd,
          label: input.label,
          lastMessage: input.lastMessage,
          lastActiveAt: now,
          ...(input.context != null ? { context: input.context } : {}),
          ...(input.ended === true ? { endedAt: now } : {}),
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
