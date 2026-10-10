import { zValidator } from '@hono/zod-validator'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { taskGithubLinks, taskWaits } from '#db/schema'
import { parseGithubIssueUrl } from '#integrations/github/issues'
import { setChangeEventTaskIds } from '#lib/change-events'
import { formatDateAtOffset } from '#lib/timezone'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import { createTaskWaitSchema, updateTaskWaitSchema } from '#schemas/task-wait'
import { taskWaitToResponse } from '#services/task-waits'

const waitIdParamsSchema = z.object({ waitId: z.uuid() })

function defaultFollowUpDate(now: Date, tzOffset: number): string {
  const date = new Date(`${formatDateAtOffset(now, tzOffset)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 3)
  return date.toISOString().slice(0, 10)
}

export const taskWaitsApp = new Hono<TaskEnv>()
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
  .post('/', zValidator('json', createTaskWaitSchema), async (c) => {
    const input = c.req.valid('json')
    const taskId = c.get('task').id
    let githubLinkId: string | null = null

    if (input.githubUrl != null) {
      const parsedUrl = parseGithubIssueUrl(input.githubUrl)
      if (parsedUrl.isErr()) {
        return c.json(
          { error: 'Invalid GitHub issue or pull request URL' },
          400,
        )
      }

      const githubLink = await db.query.taskGithubLinks.findFirst({
        where: and(
          eq(taskGithubLinks.taskId, taskId),
          eq(taskGithubLinks.owner, parsedUrl.value.owner),
          eq(taskGithubLinks.repo, parsedUrl.value.repo),
          eq(taskGithubLinks.number, parsedUrl.value.number),
          eq(taskGithubLinks.role, 'blocker'),
        ),
      })
      if (githubLink == null) {
        return c.json({ error: 'GitHub blocker not found' }, 404)
      }
      if (githubLink.state !== 'open') {
        return c.json({ error: 'GitHub blocker is not open' }, 409)
      }
      githubLinkId = githubLink.id
    }

    const [wait] = await db
      .insert(taskWaits)
      .values({
        taskId,
        body: input.body ?? null,
        githubLinkId,
        followUpDate:
          input.followUpDate ??
          defaultFollowUpDate(new Date(), input.tzOffset ?? 0),
      })
      .onConflictDoNothing({ target: taskWaits.githubLinkId })
      .returning()

    if (wait == null) {
      return c.json(
        { error: 'Wait already exists for this GitHub blocker' },
        409,
      )
    }

    return c.json(taskWaitToResponse(wait), 201)
  })
  .patch(
    '/:waitId',
    zValidator('param', waitIdParamsSchema),
    zValidator('json', updateTaskWaitSchema),
    async (c) => {
      const { waitId } = c.req.valid('param')
      const input = c.req.valid('json')
      const [wait] = await db
        .update(taskWaits)
        .set(input)
        .where(
          and(eq(taskWaits.id, waitId), eq(taskWaits.taskId, c.get('task').id)),
        )
        .returning()

      return wait
        ? c.json(taskWaitToResponse(wait), 200)
        : c.json({ error: 'Wait not found' }, 404)
    },
  )
  .post(
    '/:waitId/resolve',
    zValidator('param', waitIdParamsSchema),
    async (c) => {
      const { waitId } = c.req.valid('param')
      const taskId = c.get('task').id
      const resolvedAt = new Date()
      const [wait] = await db
        .update(taskWaits)
        .set({ resolvedAt, acknowledgedAt: resolvedAt })
        .where(
          and(
            eq(taskWaits.id, waitId),
            eq(taskWaits.taskId, taskId),
            isNull(taskWaits.resolvedAt),
          ),
        )
        .returning()

      if (wait) return c.json(taskWaitToResponse(wait), 200)

      const existing = await db.query.taskWaits.findFirst({
        where: and(eq(taskWaits.id, waitId), eq(taskWaits.taskId, taskId)),
      })
      if (!existing) return c.json({ error: 'Wait not found' }, 404)

      setChangeEventTaskIds(c, [])
      return c.json(taskWaitToResponse(existing), 200)
    },
  )
  .post(
    '/:waitId/acknowledge',
    zValidator('param', waitIdParamsSchema),
    async (c) => {
      const { waitId } = c.req.valid('param')
      const taskId = c.get('task').id
      const [wait] = await db
        .update(taskWaits)
        .set({ acknowledgedAt: new Date() })
        .where(
          and(
            eq(taskWaits.id, waitId),
            eq(taskWaits.taskId, taskId),
            isNotNull(taskWaits.resolvedAt),
            isNull(taskWaits.acknowledgedAt),
          ),
        )
        .returning()

      if (wait) return c.json(taskWaitToResponse(wait), 200)

      const existing = await db.query.taskWaits.findFirst({
        where: and(eq(taskWaits.id, waitId), eq(taskWaits.taskId, taskId)),
      })
      if (!existing) return c.json({ error: 'Wait not found' }, 404)
      if (existing.resolvedAt == null) {
        return c.json({ error: 'Wait is not resolved' }, 409)
      }

      setChangeEventTaskIds(c, [])
      return c.json(taskWaitToResponse(existing), 200)
    },
  )
  .delete('/:waitId', zValidator('param', waitIdParamsSchema), async (c) => {
    const { waitId } = c.req.valid('param')
    const deleted = await db
      .delete(taskWaits)
      .where(
        and(eq(taskWaits.id, waitId), eq(taskWaits.taskId, c.get('task').id)),
      )
      .returning({ id: taskWaits.id })

    return deleted.length > 0
      ? c.body(null, 204)
      : c.json({ error: 'Wait not found' }, 404)
  })
