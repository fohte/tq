import { db } from '@api/db/connection'
import { tasks, timeBlocks } from '@api/db/schema'
import {
  requireTask,
  taskStatus,
  taskToResponse,
  timeBlockToResponse,
  updateStatusAndCloseTimeBlocks,
} from '@api/routes/tasks/shared'
import { zValidator } from '@hono/zod-validator'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: taskStatus,
})

const updateParentSchema = z.object({
  parentId: z.string().uuid().nullable(),
})

export const tasksActionsApp = new Hono()
  .patch(
    '/:id/status',
    requireTask,
    zValidator('json', updateStatusSchema),
    async (c) => {
      const id = c.req.param('id')
      const existing = c.get('task')
      const { status } = c.req.valid('json')

      const now = new Date()

      // Close open TimeBlocks when transitioning away from in_progress
      if (existing.status === 'in_progress' && status !== 'in_progress') {
        await db
          .update(timeBlocks)
          .set({ endTime: now, updatedAt: now })
          .where(and(eq(timeBlocks.taskId, id), isNull(timeBlocks.endTime)))
      }

      const [updated] = await db
        .update(tasks)
        .set({ status, updatedAt: now })
        .where(eq(tasks.id, id))
        .returning()

      return c.json(taskToResponse(updated!), 200)
    },
  )
  .patch(
    '/:id/parent',
    requireTask,
    zValidator('json', updateParentSchema),
    async (c) => {
      const id = c.req.param('id')
      const { parentId } = c.req.valid('json')

      if (parentId) {
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

        if ((ancestors as unknown[]).length > 0) {
          return c.json({ error: 'Circular reference detected' }, 409)
        }
      }

      const [updated] = await db
        .update(tasks)
        .set({ parentId, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning()

      return c.json(taskToResponse(updated!), 200)
    },
  )
  .post('/:id/start', requireTask, async (c) => {
    const id = c.req.param('id')
    const existing = c.get('task')

    if (existing.status === 'in_progress') {
      return c.json({ error: 'Task is already in progress' }, 409)
    }

    const now = new Date()

    const [[updatedTask], [createdBlock]] = await Promise.all([
      db
        .update(tasks)
        .set({ status: 'in_progress', updatedAt: now })
        .where(eq(tasks.id, id))
        .returning(),
      db.insert(timeBlocks).values({ taskId: id, startTime: now }).returning(),
    ])

    return c.json(
      {
        ...taskToResponse(updatedTask!),
        timeBlock: timeBlockToResponse(createdBlock!),
      },
      200,
    )
  })
  .post('/:id/stop', requireTask, async (c) => {
    const id = c.req.param('id')
    const existing = c.get('task')

    if (existing.status !== 'in_progress') {
      return c.json({ error: 'Task is not in progress' }, 409)
    }

    const [updatedTask, closedBlocks] = await updateStatusAndCloseTimeBlocks(
      id,
      'todo',
    )

    return c.json(
      {
        ...taskToResponse(updatedTask),
        closedTimeBlocks: closedBlocks.map(timeBlockToResponse),
      },
      200,
    )
  })
  .post('/:id/complete', requireTask, async (c) => {
    const id = c.req.param('id')

    const [updatedTask, closedBlocks] = await updateStatusAndCloseTimeBlocks(
      id,
      'completed',
    )

    return c.json(
      {
        ...taskToResponse(updatedTask),
        closedTimeBlocks: closedBlocks.map(timeBlockToResponse),
      },
      200,
    )
  })
