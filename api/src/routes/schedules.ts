import { zValidator } from '@hono/zod-validator'
import { and, eq, gte, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, schedules, tasks, timeBlocks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { localDateBoundsToUtc } from '#lib/timezone'
import { expandScheduleForDate } from '#routes/schedule-expansion'
import { loadSchedulesWithRules } from '#routes/schedule-shared'
import { todayTasksApp } from '#routes/schedule-today-tasks'
import { timeBlockToResponse } from '#routes/tasks/shared'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'

const timePattern = /^\d{2}:\d{2}$/

const createTimeBlockSchema = z.object({
  taskId: z.uuid(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  isAutoScheduled: z.boolean().optional(),
})

const updateTimeBlockSchema = z.object({
  startTime: z.iso.datetime().optional(),
  endTime: z.iso.datetime().optional(),
  isAutoScheduled: z.boolean().optional(),
})

const timeBlockDateQuerySchema = z.object({
  date: z.string(),
  tzOffset: z.coerce.number().int().optional(),
})

const createScheduleSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern),
  recurrence: recurrenceRuleSchema.optional(),
  context: z.enum(['work', 'personal']).optional(),
  color: z.string().optional(),
})

const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  startTime: z.string().regex(timePattern).optional(),
  endTime: z.string().regex(timePattern).optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
  context: z.enum(['work', 'personal']).nullable().optional(),
  color: z.string().nullable().optional(),
})

const scheduleDateQuerySchema = z.object({
  date: z.string(),
})

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

const factory = createFactory<ScheduleEnv, '/:id'>()

const requireSchedule = factory.createMiddleware(async (c, next) => {
  const id = c.req.param('id')

  const schedule = await db.query.schedules.findFirst({
    where: eq(schedules.id, id),
  })
  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404)
  }

  const rule =
    schedule.recurrenceRuleId != null
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

      const block = firstOrThrow(
        await db
          .insert(timeBlocks)
          .values({
            taskId: input.taskId,
            startTime: new Date(input.startTime),
            endTime: new Date(input.endTime),
            isAutoScheduled: input.isAutoScheduled ?? false,
          })
          .returning(),
      )

      return c.json(timeBlockToResponse(block), 201)
    },
  )
  .get(
    '/time-blocks',
    zValidator('query', timeBlockDateQuerySchema),
    async (c) => {
      const { date, tzOffset } = c.req.valid('query')
      const { dayStart, dayEnd } = localDateBoundsToUtc(date, tzOffset ?? 0)

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
        return c.json(timeBlockToResponse(existing), 200)
      }

      const updated = firstOrThrow(
        await db
          .update(timeBlocks)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(timeBlocks.id, id))
          .returning(),
      )

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

    return c.body(null, 204)
  })
  // Recurring schedule (ScheduleBlock) CRUD
  .post('/recurring', zValidator('json', createScheduleSchema), async (c) => {
    const input = c.req.valid('json')

    let newRule: typeof recurrenceRules.$inferSelect | null = null

    if (input.recurrence != null) {
      newRule = firstOrThrow(
        await db
          .insert(recurrenceRules)
          .values({
            type: input.recurrence.type,
            interval: input.recurrence.interval,
            daysOfWeek: input.recurrence.daysOfWeek ?? null,
            dayOfMonth: input.recurrence.dayOfMonth ?? null,
          })
          .returning(),
      )
    }

    const schedule = firstOrThrow(
      await db
        .insert(schedules)
        .values({
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          recurrenceRuleId: newRule?.id ?? null,
          context: input.context ?? 'personal',
          color: input.color ?? null,
        })
        .returning(),
    )

    return c.json(scheduleToResponse(schedule, newRule), 201)
  })
  .get(
    '/recurring',
    zValidator('query', scheduleDateQuerySchema),
    async (c) => {
      const { date } = c.req.valid('query')

      const scheduleRules = await loadSchedulesWithRules()

      const expanded = scheduleRules.flatMap(({ schedule, rule }) =>
        expandScheduleForDate(schedule, rule, date).map((block) => ({
          ...block,
          recurrence: recurrenceRuleToResponse(rule),
        })),
      )

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
          if (recurrenceRuleId != null) {
            await db
              .delete(recurrenceRules)
              .where(eq(recurrenceRules.id, recurrenceRuleId))
          }
          recurrenceRuleId = null
        } else if (recurrenceRuleId != null) {
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
          const rule = firstOrThrow(
            await db
              .insert(recurrenceRules)
              .values({
                type: input.recurrence.type,
                interval: input.recurrence.interval,
                daysOfWeek: input.recurrence.daysOfWeek ?? null,
                dayOfMonth: input.recurrence.dayOfMonth ?? null,
              })
              .returning(),
          )
          recurrenceRuleId = rule.id
        }
      }

      const updated = firstOrThrow(
        await db
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
          .returning(),
      )

      const rule =
        recurrenceRuleId != null
          ? ((await db.query.recurrenceRules.findFirst({
              where: eq(recurrenceRules.id, recurrenceRuleId),
            })) ?? null)
          : null

      return c.json(scheduleToResponse(updated, rule), 200)
    },
  )
  .delete('/recurring/:id', requireSchedule, async (c) => {
    const id = c.req.param('id')
    const existingSchedule = c.get('schedule')

    // Delete the schedule first
    await db.delete(schedules).where(eq(schedules.id, id))

    // Clean up orphaned recurrence rule
    if (existingSchedule.recurrenceRuleId != null) {
      await db
        .delete(recurrenceRules)
        .where(eq(recurrenceRules.id, existingSchedule.recurrenceRuleId))
    }

    return c.body(null, 204)
  })
  .route('/', todayTasksApp)
