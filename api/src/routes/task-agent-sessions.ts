import { zValidator } from '@hono/zod-validator'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { agentSessions, taskAgentSessions } from '#db/schema'
import { agentSessionToResponse } from '#routes/agent-sessions'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import { linkAgentSessionSchema } from '#schemas/task-agent-session'

export const taskAgentSessionsApp = new Hono<TaskEnv>()
  .use('*', async (c, next) => {
    const param = c.req.param('taskId')
    if (param == null) {
      return c.json({ error: 'taskId is required' }, 400)
    }

    const task = await findTaskByIdOrNumber(param)
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    c.set('task', task)
    return next()
  })
  .get('/', async (c) => {
    const taskId = c.get('task').id

    const rows = await db
      .select({ session: agentSessions })
      .from(taskAgentSessions)
      .innerJoin(
        agentSessions,
        eq(taskAgentSessions.agentSessionId, agentSessions.id),
      )
      .where(eq(taskAgentSessions.taskId, taskId))
      .orderBy(desc(agentSessions.lastActiveAt))

    return c.json(
      rows.map((row) => agentSessionToResponse(row.session)),
      200,
    )
  })
  .post('/', zValidator('json', linkAgentSessionSchema), async (c) => {
    const taskId = c.get('task').id
    const { agentSessionId } = c.req.valid('json')

    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, agentSessionId),
    })
    if (!session) {
      return c.json({ error: 'Agent session not found' }, 404)
    }

    const inserted = await db
      .insert(taskAgentSessions)
      .values({ taskId, agentSessionId })
      .onConflictDoNothing({
        target: [taskAgentSessions.taskId, taskAgentSessions.agentSessionId],
      })
      .returning()

    return c.json(
      agentSessionToResponse(session),
      inserted.length > 0 ? 201 : 200,
    )
  })
  .delete('/:agentSessionId', async (c) => {
    const taskId = c.get('task').id
    const agentSessionId = c.req.param('agentSessionId')

    const deleted = await db
      .delete(taskAgentSessions)
      .where(
        and(
          eq(taskAgentSessions.taskId, taskId),
          eq(taskAgentSessions.agentSessionId, agentSessionId),
        ),
      )
      .returning()

    if (deleted.length === 0) {
      return c.json({ error: 'Link not found' }, 404)
    }

    return c.body(null, 204)
  })
