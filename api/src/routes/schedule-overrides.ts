import { zValidator } from '@hono/zod-validator'
import { and, eq, gte, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { scheduleOverrides, schedules } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { scheduleOccursOnDate } from '#routes/schedule-expansion'
import {
  buildScheduleOverrideClearPreview,
  buildScheduleOverridePreview,
} from '#routes/schedule-preview'
import { loadScheduleWithRevisions } from '#routes/schedule-shared'
import {
  scheduleOverrideDateSchema,
  setScheduleOverrideBodySchema,
} from '#schemas/schedule-override'

const scheduleOverrideParamsSchema = z.object({
  scheduleId: z.string().min(1),
  occurrenceDate: scheduleOverrideDateSchema,
})

const scheduleOverridesQuerySchema = z.object({
  fromDate: scheduleOverrideDateSchema.optional(),
})

const clearScheduleOverrideQuerySchema = z.object({
  dryRun: z.enum(['true', 'false']).optional(),
})

async function findSchedule(scheduleId: string) {
  return db.query.schedules.findFirst({
    where: eq(schedules.id, scheduleId),
  })
}

export const scheduleOverridesApp = new Hono()
  .get(
    '/events/:scheduleId/overrides',
    zValidator('param', z.object({ scheduleId: z.string().min(1) })),
    zValidator('query', scheduleOverridesQuerySchema),
    async (c) => {
      const { scheduleId } = c.req.valid('param')
      const schedule = await findSchedule(scheduleId)
      if (!schedule) {
        return c.json({ error: 'Schedule not found' }, 404)
      }

      const { fromDate } = c.req.valid('query')
      const conditions = [eq(scheduleOverrides.scheduleId, scheduleId)]
      const where =
        fromDate === undefined
          ? conditions[0]
          : and(
              conditions[0],
              or(
                gte(scheduleOverrides.occurrenceDate, fromDate),
                gte(scheduleOverrides.movedToDate, fromDate),
              ),
            )
      const overrides = await db
        .select({
          occurrenceDate: scheduleOverrides.occurrenceDate,
          movedToDate: scheduleOverrides.movedToDate,
          skipped: scheduleOverrides.skipped,
        })
        .from(scheduleOverrides)
        .where(where)
        .orderBy(scheduleOverrides.occurrenceDate)

      return c.json(overrides, 200)
    },
  )
  .put(
    '/events/:scheduleId/overrides/:occurrenceDate',
    zValidator('param', scheduleOverrideParamsSchema),
    zValidator('json', setScheduleOverrideBodySchema),
    async (c) => {
      const { scheduleId, occurrenceDate } = c.req.valid('param')
      const schedule = await loadScheduleWithRevisions(scheduleId)
      if (!schedule) {
        return c.json({ error: 'Schedule not found' }, 404)
      }

      if (
        !scheduleOccursOnDate(schedule, new Date(`${occurrenceDate}T00:00:00`))
      ) {
        return c.json(
          { error: 'Date is not an occurrence of this schedule' },
          422,
        )
      }

      const input = c.req.valid('json')
      const values =
        input.skipped === true
          ? {
              startTime: null,
              endTime: null,
              movedToDate: null,
              skipped: true,
            }
          : {
              startTime: input.startTime,
              endTime: input.endTime,
              movedToDate:
                input.date === occurrenceDate ? null : (input.date ?? null),
              skipped: false,
            }

      if (input.dryRun === true) {
        const overrides = await db
          .select()
          .from(scheduleOverrides)
          .where(eq(scheduleOverrides.scheduleId, scheduleId))
        return c.json(
          buildScheduleOverridePreview(
            schedule,
            overrides,
            occurrenceDate,
            values,
          ),
          200,
        )
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
          movedToDate: override.movedToDate,
          skipped: override.skipped,
        },
        200,
      )
    },
  )
  .delete(
    '/events/:scheduleId/overrides/:occurrenceDate',
    zValidator('param', scheduleOverrideParamsSchema),
    zValidator('query', clearScheduleOverrideQuerySchema),
    async (c) => {
      const { scheduleId, occurrenceDate } = c.req.valid('param')
      const schedule = await loadScheduleWithRevisions(scheduleId)
      if (!schedule) {
        return c.json({ error: 'Schedule not found' }, 404)
      }

      const { dryRun } = c.req.valid('query')
      if (dryRun === 'true') {
        const overrides = await db
          .select()
          .from(scheduleOverrides)
          .where(eq(scheduleOverrides.scheduleId, scheduleId))
        return c.json(
          buildScheduleOverrideClearPreview(
            schedule,
            overrides,
            occurrenceDate,
          ),
          200,
        )
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
