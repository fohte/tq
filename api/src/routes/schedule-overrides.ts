import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { scheduleOverrides, schedules } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import {
  evaluateScheduleConstraintViolations,
  evaluateScheduleConstraintViolationsForSaveResponse,
  scheduleConstraintWeekRange,
} from '#routes/schedule-constraint-evaluation'
import { scheduleOccursOnDate } from '#routes/schedule-expansion'
import { buildScheduleOverridePreview } from '#routes/schedule-preview'
import { loadScheduleWithRevisions } from '#routes/schedule-shared'
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

      const [previousOverride] = await db
        .select({ movedToDate: scheduleOverrides.movedToDate })
        .from(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.scheduleId, scheduleId),
            eq(scheduleOverrides.occurrenceDate, occurrenceDate),
          ),
        )
        .limit(1)

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

      const affectedDates = [
        occurrenceDate,
        previousOverride?.movedToDate,
        override.movedToDate,
      ].filter((date): date is string => date != null)
      const affectedRanges = [
        ...new Map(
          affectedDates.map((date) => {
            const range = scheduleConstraintWeekRange(date)
            return [range.startDate, range] as const
          }),
        ).values(),
      ]
      const evaluations = await Promise.all(
        affectedRanges.map((range) =>
          evaluateScheduleConstraintViolationsForSaveResponse(
            evaluateScheduleConstraintViolations({ series: schedule, range }),
            schedule.schedule.id,
          ),
        ),
      )
      const constraintViolations = evaluations.flatMap(
        ({ constraintViolations }) => constraintViolations,
      )
      const calendarDataIncomplete = evaluations.some(
        ({ calendarDataIncomplete }) => calendarDataIncomplete,
      )
      const constraintEvaluationIncomplete = evaluations.some(
        ({ constraintEvaluationIncomplete }) => constraintEvaluationIncomplete,
      )

      return c.json(
        {
          scheduleId: override.scheduleId,
          occurrenceDate: override.occurrenceDate,
          startTime: override.startTime,
          endTime: override.endTime,
          movedToDate: override.movedToDate,
          skipped: override.skipped,
          constraintViolations,
          ...(calendarDataIncomplete ? { calendarDataIncomplete: true } : {}),
          ...(constraintEvaluationIncomplete
            ? { constraintEvaluationIncomplete: true }
            : {}),
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
