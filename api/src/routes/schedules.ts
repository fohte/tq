import { db } from '@api/db/connection'
import { recurrenceRules, schedules, tasks, timeBlocks } from '@api/db/schema'
import { expandScheduleForDate } from '@api/routes/schedule-expansion'
import { zValidator } from '@hono/zod-validator'
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'
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

function recurrenceRuleToResponse(
  rule: typeof recurrenceRules.$inferSelect | null,
) {
  if (!rule) return null
  return {
    id: rule.id,
    type: rule.type,
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
  }
}

function scheduleToResponse(
  schedule: typeof schedules.$inferSelect,
  rule: typeof recurrenceRules.$inferSelect | null,
) {
  return {
    id: schedule.id,
    title: schedule.title,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    recurrence: recurrenceRuleToResponse(rule),
    context: schedule.context,
    color: schedule.color,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  }
}

type ScheduleEnv = {
  Variables: {
    schedule: typeof schedules.$inferSelect
    recurrenceRule: typeof recurrenceRules.$inferSelect | null
  }
}

const factory = createFactory<ScheduleEnv>()

const requireSchedule = factory.createMiddleware(async (c, next) => {
  const id = c.req.param('id')!

  const schedule = await db.query.schedules.findFirst({
    where: eq(schedules.id, id),
  })
  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404)
  }

  const rule = schedule.recurrenceRuleId
    ? ((await db.query.recurrenceRules.findFirst({
        where: eq(recurrenceRules.id, schedule.recurrenceRuleId),
      })) ?? null)
    : null

  c.set('schedule', schedule)
  c.set('recurrenceRule', rule)
  return next()
})

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
  // Today tasks endpoints (not yet implemented)
  .put('/today-tasks', zValidator('json', todayTasksSchema), (c) => {
    return c.json([], 200)
  })
  // Auto-assign endpoint (not yet implemented)
  .post('/auto-assign', zValidator('json', autoAssignSchema), (c) => {
    return c.json([], 200)
  })
  // Recurring schedule (ScheduleBlock) CRUD
  .post('/recurring', zValidator('json', createScheduleSchema), async (c) => {
    const input = c.req.valid('json')

    let newRule: typeof recurrenceRules.$inferSelect | null = null

    if (input.recurrence) {
      const [rule] = await db
        .insert(recurrenceRules)
        .values({
          type: input.recurrence.type,
          interval: input.recurrence.interval,
          daysOfWeek: input.recurrence.daysOfWeek ?? null,
          dayOfMonth: input.recurrence.dayOfMonth ?? null,
        })
        .returning()
      newRule = rule!
    }

    const [schedule] = await db
      .insert(schedules)
      .values({
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        recurrenceRuleId: newRule?.id ?? null,
        context: input.context ?? 'personal',
        color: input.color ?? null,
      })
      .returning()

    return c.json(scheduleToResponse(schedule!, newRule), 201)
  })
  .get(
    '/recurring',
    zValidator('query', scheduleDateQuerySchema),
    async (c) => {
      const { date } = c.req.valid('query')

      const allSchedules = await db.select().from(schedules)

      // Fetch all referenced recurrence rules
      const ruleIds = [
        ...new Set(
          allSchedules
            .map((s) => s.recurrenceRuleId)
            .filter((id): id is string => id != null),
        ),
      ]

      const rules =
        ruleIds.length > 0
          ? await db
              .select()
              .from(recurrenceRules)
              .where(inArray(recurrenceRules.id, ruleIds))
          : []

      const ruleMap = new Map(rules.map((r) => [r.id, r]))

      // Expand schedules for the requested date
      const expanded = allSchedules.flatMap((schedule) => {
        const rule = schedule.recurrenceRuleId
          ? (ruleMap.get(schedule.recurrenceRuleId) ?? null)
          : null
        return expandScheduleForDate(schedule, rule, date).map((block) => ({
          ...block,
          recurrence: recurrenceRuleToResponse(rule),
        }))
      })

      return c.json(expanded, 200)
    },
  )
  .patch(
    '/recurring/:id',
    requireSchedule,
    zValidator('json', updateScheduleSchema),
    async (c) => {
      const id = c.req.param('id')
      const input = c.req.valid('json')
      const existingSchedule = c.get('schedule')

      const now = new Date()
      let recurrenceRuleId = existingSchedule.recurrenceRuleId

      // Handle recurrence update
      if (input.recurrence !== undefined) {
        if (input.recurrence === null) {
          // Remove recurrence: delete old rule if exists
          if (recurrenceRuleId) {
            await db
              .delete(recurrenceRules)
              .where(eq(recurrenceRules.id, recurrenceRuleId))
          }
          recurrenceRuleId = null
        } else if (recurrenceRuleId) {
          // Update existing rule
          await db
            .update(recurrenceRules)
            .set({
              type: input.recurrence.type,
              interval: input.recurrence.interval,
              daysOfWeek: input.recurrence.daysOfWeek ?? null,
              dayOfMonth: input.recurrence.dayOfMonth ?? null,
              updatedAt: now,
            })
            .where(eq(recurrenceRules.id, recurrenceRuleId))
        } else {
          // Create new rule
          const [rule] = await db
            .insert(recurrenceRules)
            .values({
              type: input.recurrence.type,
              interval: input.recurrence.interval,
              daysOfWeek: input.recurrence.daysOfWeek ?? null,
              dayOfMonth: input.recurrence.dayOfMonth ?? null,
            })
            .returning()
          recurrenceRuleId = rule!.id
        }
      }

      const [updated] = await db
        .update(schedules)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.startTime !== undefined
            ? { startTime: input.startTime }
            : {}),
          ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
          ...(input.context !== undefined
            ? { context: input.context ?? 'personal' }
            : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          recurrenceRuleId,
          updatedAt: now,
        })
        .where(eq(schedules.id, id))
        .returning()

      const rule = recurrenceRuleId
        ? ((await db.query.recurrenceRules.findFirst({
            where: eq(recurrenceRules.id, recurrenceRuleId),
          })) ?? null)
        : null

      return c.json(scheduleToResponse(updated!, rule), 200)
    },
  )
  .delete('/recurring/:id', requireSchedule, async (c) => {
    const id = c.req.param('id')
    const existingSchedule = c.get('schedule')

    // Delete the schedule first
    await db.delete(schedules).where(eq(schedules.id, id))

    // Clean up orphaned recurrence rule
    if (existingSchedule.recurrenceRuleId) {
      await db
        .delete(recurrenceRules)
        .where(eq(recurrenceRules.id, existingSchedule.recurrenceRuleId))
    }

    return c.body(null, 204)
  })
