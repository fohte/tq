import { zValidator } from '@hono/zod-validator'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { taskWaits } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import { createTaskWaitSchema, updateTaskWaitSchema } from '#schemas/task-wait'
import { taskWaitToResponse } from '#services/task-waits'

const waitIdParamsSchema = z.object({ waitId: z.uuid() })

function defaultFollowUpDate(now: Date): string {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
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
    const wait = firstOrThrow(
      await db
        .insert(taskWaits)
        .values({
          taskId: c.get('task').id,
          body: input.body,
          followUpDate: input.followUpDate ?? defaultFollowUpDate(new Date()),
        })
        .returning(),
    )

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
