import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { scheduleOverrides, schedules } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
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

export const scheduleOverridesApp = new Hono()
  .put(
    '/recurring/:scheduleId/overrides/:occurrenceDate',
    zValidator('param', scheduleOverrideParamsSchema),
    zValidator('json', setScheduleOverrideBodySchema),
    async (c) => {
      const { scheduleId, occurrenceDate } = c.req.valid('param')
      if (!(await findSchedule(scheduleId))) {
        return c.json({ error: 'Schedule not found' }, 404)
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
    '/recurring/:scheduleId/overrides/:occurrenceDate',
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
