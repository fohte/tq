import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, tasks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { requireTask, taskStatus, taskToResponse } from '#routes/tasks/shared'
import { buildNextTaskData } from '#services/recurrence'
import { syncTaskLinks } from '#services/task-links'

const updateStatusSchema = z.object({
  status: taskStatus,
})

const updateParentSchema = z.object({
  parentId: z.uuid().nullable(),
})

export const tasksActionsApp = new Hono()
  .patch(
    '/:id/status',
    requireTask,
    zValidator('json', updateStatusSchema),
    async (c) => {
      const existing = c.get('task')
      const id = existing.id
      const { status } = c.req.valid('json')

      const updated = firstOrThrow(
        await db
          .update(tasks)
          .set({ status, updatedAt: new Date() })
          .where(eq(tasks.id, id))
          .returning(),
      )

      return c.json(taskToResponse(updated), 200)
    },
  )
  .patch(
    '/:id/parent',
    requireTask,
    zValidator('json', updateParentSchema),
    async (c) => {
      const id = c.get('task').id
      const { parentId } = c.req.valid('json')

      if (parentId != null) {
        const parent = await db.query.tasks.findFirst({
          where: eq(tasks.id, parentId),
        })
        if (!parent) {
          return c.json({ error: 'Parent task not found' }, 404)
        }

        if (parentId === id) {
          return c.json({ error: 'A task cannot be its own parent' }, 409)
        }

        // Check for circular reference by walking ancestors
        const ancestors = await db.execute(sql`
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_id FROM ${tasks} WHERE id = ${parentId}
          UNION ALL
          SELECT t.id, t.parent_id
          FROM ${tasks} t
          INNER JOIN ancestors a ON t.id = a.parent_id
        )
        SELECT id FROM ancestors WHERE id = ${id}
      `)

        const ancestorRows = z
          .array(z.object({ id: z.string() }))
          .parse(ancestors)
        if (ancestorRows.length > 0) {
          return c.json({ error: 'Circular reference detected' }, 409)
        }
      }

      const updated = firstOrThrow(
        await db
          .update(tasks)
          .set({ parentId, updatedAt: new Date() })
          .where(eq(tasks.id, id))
          .returning(),
      )

      return c.json(taskToResponse(updated), 200)
    },
  )
  .post('/:id/complete', requireTask, async (c) => {
    const existing = c.get('task')
    const id = existing.id

    if (existing.status === 'completed') {
      return c.json({ error: 'Task is already completed' }, 409)
    }

    const updatedTask = firstOrThrow(
      await db
        .update(tasks)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning(),
    )

    let nextTask: ReturnType<typeof taskToResponse> | null = null
    let completedTaskRule: typeof recurrenceRules.$inferSelect | null = null
    if (updatedTask.recurrenceRuleId != null) {
      completedTaskRule =
        (await db.query.recurrenceRules.findFirst({
          where: eq(recurrenceRules.id, updatedTask.recurrenceRuleId),
        })) ?? null

      if (completedTaskRule) {
        const nextDataResult = buildNextTaskData(updatedTask, completedTaskRule)
        if (nextDataResult.isErr()) {
          captureWithFingerprint(
            nextDataResult.error,
            'api.tasks.build-next-task-data-failed',
          )
          return c.json({ error: 'Internal server error' }, 500)
        }
        const created = firstOrThrow(
          await db.insert(tasks).values(nextDataResult.value).returning(),
        )
        await syncTaskLinks(created.id)
        nextTask = taskToResponse(created, completedTaskRule)
      }
    }

    return c.json(
      {
        ...taskToResponse(updatedTask, completedTaskRule),
        nextTask,
      },
      200,
    )
  })
