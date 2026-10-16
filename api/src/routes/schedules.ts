import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, schedules } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import {
  expandScheduleForDate,
  formatDateStr,
} from '#routes/schedule-expansion'
import { scheduleOverridesApp } from '#routes/schedule-overrides'
import {
  loadScheduleOverridesForExpansion,
  loadSchedulesWithRules,
} from '#routes/schedule-shared'
import { scheduleTimeBlocksApp } from '#routes/schedule-time-blocks'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'
import {
  createScheduleSchema,
  scheduleDateRangeSchema,
  scheduleTimeSchema,
} from '#schemas/schedule'

const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  startDate: z.iso.date().optional(),
  startTime: scheduleTimeSchema.optional(),
  endTime: scheduleTimeSchema.optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
  context: z.enum(['work', 'personal']).nullable().optional(),
  color: z.string().nullable().optional(),
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
    startDate: schedule.startDate,
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
  .route('/', scheduleTimeBlocksApp)
  .post('/events', zValidator('json', createScheduleSchema), async (c) => {
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
          startDate: input.startDate,
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
  .get('/events', zValidator('query', scheduleDateRangeSchema), async (c) => {
    const { startDate, endDate } = c.req.valid('query')

    const scheduleRules = await loadSchedulesWithRules()

    const dates: string[] = []
    const cursor = new Date(startDate + 'T00:00:00')
    const endBound = new Date(endDate + 'T00:00:00')
    while (cursor <= endBound) {
      dates.push(formatDateStr(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    const overridesBySchedule = await loadScheduleOverridesForExpansion(
      startDate,
      endDate,
    )

    const expanded = dates.flatMap((dateStr) =>
      scheduleRules.flatMap(({ schedule, rule }) =>
        expandScheduleForDate(
          schedule,
          rule,
          dateStr,
          overridesBySchedule.get(schedule.id),
        ).map((block) => ({
          ...block,
          recurrence: recurrenceRuleToResponse(rule),
        })),
      ),
    )

    return c.json(expanded, 200)
  })
  .patch(
    '/events/:id',
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
            ...(input.startDate !== undefined
              ? { startDate: input.startDate }
              : {}),
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
  .delete('/events/:id', requireSchedule, async (c) => {
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
  .route('/', scheduleOverridesApp)
