import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, scheduleOverrides, schedules } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { scheduleOccursOnDate } from '#routes/schedule-expansion'
import {
  scheduleOverrideDateSchema,
  setScheduleOverrideBodySchema,
} from '#schemas/schedule-override'

const scheduleOverrideParamsSchema = z.object({
  scheduleId: z.string().min(1),
  occurrenceDate: scheduleOverrideDateSchema,
})

async function findSchedule(scheduleId: string) {
  return db.query.schedules.findFirst({
    where: eq(schedules.id, scheduleId),
  })
}

async function findScheduleWithRule(scheduleId: string) {
  const schedule = await findSchedule(scheduleId)
  if (!schedule) return null

  const rule =
    schedule.recurrenceRuleId != null
      ? await db.query.recurrenceRules.findFirst({
          where: eq(recurrenceRules.id, schedule.recurrenceRuleId),
        })
      : null

  return { schedule, rule: rule ?? null }
}

export const scheduleOverridesApp = new Hono()
  .put(
    '/events/:scheduleId/overrides/:occurrenceDate',
    zValidator('param', scheduleOverrideParamsSchema),
    zValidator('json', setScheduleOverrideBodySchema),
    async (c) => {
      const { scheduleId, occurrenceDate } = c.req.valid('param')
      const scheduleWithRule = await findScheduleWithRule(scheduleId)
      if (!scheduleWithRule) {
        return c.json({ error: 'Schedule not found' }, 404)
      }

      if (
        !scheduleOccursOnDate(
          scheduleWithRule.schedule,
          scheduleWithRule.rule,
          new Date(`${occurrenceDate}T00:00:00`),
        )
      ) {
        return c.json(
          { error: 'Date is not an occurrence of this schedule' },
          422,
        )
      }

      const input = c.req.valid('json')
      const values =
        input.skipped === true
          ? { startTime: null, endTime: null, skipped: true }
          : {
              startTime: input.startTime,
              endTime: input.endTime,
              skipped: false,
            }

      const override = firstOrThrow(
        await db
          .insert(scheduleOverrides)
          .values({ scheduleId, occurrenceDate, ...values })
          .onConflictDoUpdate({
            target: [
              scheduleOverrides.scheduleId,
              scheduleOverrides.occurrenceDate,
            ],
            set: values,
          })
          .returning(),
      )

      return c.json(
        {
          scheduleId: override.scheduleId,
          occurrenceDate: override.occurrenceDate,
          startTime: override.startTime,
          endTime: override.endTime,
          skipped: override.skipped,
        },
        200,
      )
    },
  )
  .delete(
    '/events/:scheduleId/overrides/:occurrenceDate',
    zValidator('param', scheduleOverrideParamsSchema),
    async (c) => {
      const { scheduleId, occurrenceDate } = c.req.valid('param')
      if (!(await findSchedule(scheduleId))) {
        return c.json({ error: 'Schedule not found' }, 404)
      }

      await db
        .delete(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.scheduleId, scheduleId),
            eq(scheduleOverrides.occurrenceDate, occurrenceDate),
          ),
        )

      return c.body(null, 204)
    },
  )
