import { db } from '@api/db/connection'
import { tasks, timeBlocks } from '@api/db/schema'
import { zValidator } from '@hono/zod-validator'
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const timePattern = /^\d{2}:\d{2}$/

const recurrenceRuleSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval: z.number().int().positive(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
})

const createTimeBlockSchema = z.object({
  taskId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable().optional(),
  isAutoScheduled: z.boolean().optional(),
})

const updateTimeBlockSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().nullable().optional(),
  isAutoScheduled: z.boolean().optional(),
})

const timeBlockDateQuerySchema = z.object({
  date: z.string(),
})

const todayTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()),
})

const autoAssignSchema = z.object({
  date: z.string(),
})

const createScheduleSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern),
  recurrence: recurrenceRuleSchema.optional(),
  context: z.enum(['work', 'personal', 'dev']).optional(),
  color: z.string().optional(),
})

const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  startTime: z.string().regex(timePattern).optional(),
  endTime: z.string().regex(timePattern).optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
  context: z.enum(['work', 'personal', 'dev']).nullable().optional(),
  color: z.string().nullable().optional(),
})

const scheduleDateQuerySchema = z.object({
  date: z.string(),
})

function timeBlockToResponse(block: typeof timeBlocks.$inferSelect) {
  return {
    id: block.id,
    taskId: block.taskId,
    startTime: block.startTime.toISOString(),
    endTime: block.endTime?.toISOString() ?? null,
    isAutoScheduled: block.isAutoScheduled,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  }
}

export const schedulesApp = new Hono()
  // TimeBlock endpoints
  .post(
    '/time-blocks',
    zValidator('json', createTimeBlockSchema),
    async (c) => {
      const input = c.req.valid('json')

      // Verify task exists
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      })
      if (!task) {
        return c.json({ error: 'Task not found' }, 404)
      }

      const [block] = await db
        .insert(timeBlocks)
        .values({
          taskId: input.taskId,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : null,
          isAutoScheduled: input.isAutoScheduled ?? false,
        })
        .returning()

      return c.json(timeBlockToResponse(block!), 201)
    },
  )
  .get(
    '/time-blocks',
    zValidator('query', timeBlockDateQuerySchema),
    async (c) => {
      const { date } = c.req.valid('query')

      // Get all time blocks that overlap with the given date
      const dayStart = new Date(`${date}T00:00:00.000Z`)
      const dayEnd = new Date(`${date}T23:59:59.999Z`)

      const blocks = await db
        .select()
        .from(timeBlocks)
        .where(
          and(
            lte(timeBlocks.startTime, dayEnd),
            or(gte(timeBlocks.endTime, dayStart), isNull(timeBlocks.endTime)),
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
        updates.endTime = input.endTime ? new Date(input.endTime) : null
      }
      if (input.isAutoScheduled !== undefined) {
        updates.isAutoScheduled = input.isAutoScheduled
      }

      if (Object.keys(updates).length === 0) {
        return c.json(timeBlockToResponse(existing), 200)
      }

      const [updated] = await db
        .update(timeBlocks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(timeBlocks.id, id))
        .returning()

      return c.json(timeBlockToResponse(updated!), 200)
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

    return c.body(null, 204)
  })
  // Today tasks endpoints
  .put('/today-tasks', zValidator('json', todayTasksSchema), (c) => {
    // TODO: implement today tasks update
    return c.json([], 200)
  })
  // Auto-assign endpoint
  .post('/auto-assign', zValidator('json', autoAssignSchema), (c) => {
    // TODO: implement auto-assign
    return c.json([], 200)
  })
  // Recurring schedule (ScheduleBlock) endpoints
  .post('/recurring', zValidator('json', createScheduleSchema), (c) => {
    // TODO: implement recurring schedule creation
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/recurring', zValidator('query', scheduleDateQuerySchema), (c) => {
    // TODO: implement recurring schedule listing by date
    return c.json([], 200)
  })
  .patch('/recurring/:id', zValidator('json', updateScheduleSchema), (c) => {
    // TODO: implement recurring schedule update
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .delete('/recurring/:id', (c) => {
    // TODO: implement recurring schedule deletion
    void c.req.param('id')
    return c.json(null, 501)
  })
