import { zValidator } from '@hono/zod-validator'
import { and, eq, gte, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { timeBlocks } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import { taskIdOrNumber } from '#lib/numeric-id'
import { localDateBoundsToUtc } from '#lib/timezone'
import { findTaskByIdOrNumber, timeBlockToResponse } from '#routes/tasks/shared'
import { scheduleDateRangeSchema } from '#schemas/schedule'

const createTimeBlockSchema = z.object({
  taskId: taskIdOrNumber,
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  isAutoScheduled: z.boolean().optional(),
})

const updateTimeBlockSchema = z.object({
  startTime: z.iso.datetime().optional(),
  endTime: z.iso.datetime().optional(),
  isAutoScheduled: z.boolean().optional(),
})

const timeBlockDateQuerySchema = scheduleDateRangeSchema.safeExtend({
  tzOffset: z.coerce.number().int().optional(),
})

export const scheduleTimeBlocksApp = new Hono()
  .post(
    '/time-blocks',
    zValidator('json', createTimeBlockSchema),
    async (c) => {
      const input = c.req.valid('json')

      // Verify task exists
      const task = await findTaskByIdOrNumber(String(input.taskId))
      if (!task) {
        return c.json({ error: 'Task not found' }, 404)
      }

      const block = firstOrThrow(
        await db
          .insert(timeBlocks)
          .values({
            taskId: task.id,
            startTime: new Date(input.startTime),
            endTime: new Date(input.endTime),
            isAutoScheduled: input.isAutoScheduled ?? false,
          })
          .returning(),
      )

      setChangeEventTaskIds(c, [task.id])

      return c.json(timeBlockToResponse(block), 201)
    },
  )
  .get(
    '/time-blocks',
    zValidator('query', timeBlockDateQuerySchema),
    async (c) => {
      const { startDate, endDate, tzOffset } = c.req.valid('query')
      const { dayStart } = localDateBoundsToUtc(startDate, tzOffset ?? 0)
      const { dayEnd } = localDateBoundsToUtc(endDate, tzOffset ?? 0)

      const blocks = await db
        .select()
        .from(timeBlocks)
        .where(
          and(
            lte(timeBlocks.startTime, dayEnd),
            gte(timeBlocks.endTime, dayStart),
          ),
        )
        .orderBy(timeBlocks.startTime)

      return c.json(blocks.map(timeBlockToResponse), 200)
    },
  )
  .patch(
    '/time-blocks/:id',
    zValidator('json', updateTimeBlockSchema),
    async (c) => {
      const id = c.req.param('id')

      const existing = await db.query.timeBlocks.findFirst({
        where: eq(timeBlocks.id, id),
      })
      if (!existing) {
        return c.json({ error: 'Time block not found' }, 404)
      }

      const input = c.req.valid('json')
      const updates: Partial<typeof timeBlocks.$inferInsert> = {}

      if (input.startTime !== undefined) {
        updates.startTime = new Date(input.startTime)
      }
      if (input.endTime !== undefined) {
        updates.endTime = new Date(input.endTime)
      }
      if (input.isAutoScheduled !== undefined) {
        updates.isAutoScheduled = input.isAutoScheduled
      }

      if (Object.keys(updates).length === 0) {
        setChangeEventTaskIds(c, [])
        return c.json(timeBlockToResponse(existing), 200)
      }

      const updated = firstOrThrow(
        await db
          .update(timeBlocks)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(timeBlocks.id, id))
          .returning(),
      )

      setChangeEventTaskIds(c, [existing.taskId])

      return c.json(timeBlockToResponse(updated), 200)
    },
  )
  .delete('/time-blocks/:id', async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Time block not found' }, 404)
    }

    await db.delete(timeBlocks).where(eq(timeBlocks.id, id))

    setChangeEventTaskIds(c, [existing.taskId])

    return c.body(null, 204)
  })
