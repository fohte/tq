import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { scheduleConstraints, scheduleConstraintWeekdays } from '#db/schema'
import { evaluateScheduleConstraintViolationsSafely } from '#routes/schedule-constraint-evaluation'
import { formatDateStr, type ScheduleSeries } from '#routes/schedule-expansion'
import { buildSchedulePreviewRange } from '#routes/schedule-preview'
import { loadScheduleWithRevisions } from '#routes/schedule-shared'
import { scheduleConstraintSchema } from '#services/schedule-constraints'

async function loadScheduleConstraint(scheduleId: string) {
  const [row] = await db
    .select({
      weeklyMin: scheduleConstraints.weeklyMin,
      weeklyMax: scheduleConstraints.weeklyMax,
      weeklyTarget: scheduleConstraints.weeklyTarget,
      maxConsecutiveDays: scheduleConstraints.maxConsecutiveDays,
      windowStart: scheduleConstraints.windowStart,
      windowEnd: scheduleConstraints.windowEnd,
    })
    .from(scheduleConstraints)
    .where(eq(scheduleConstraints.scheduleId, scheduleId))
    .limit(1)
  if (!row) return null

  const weekdays = await db
    .select({
      dayOfWeek: scheduleConstraintWeekdays.dayOfWeek,
      preference: scheduleConstraintWeekdays.preference,
    })
    .from(scheduleConstraintWeekdays)
    .where(eq(scheduleConstraintWeekdays.scheduleId, scheduleId))
    .orderBy(asc(scheduleConstraintWeekdays.dayOfWeek))

  const parsed = scheduleConstraintSchema.safeParse({ ...row, weekdays })
  if (parsed.success) return parsed.data

  captureWithFingerprint(
    parsed.error,
    'api.schedule.constraints.invalid-data',
    { extras: { scheduleId } },
  )
  return null
}

async function evaluateSavedConstraints(series: ScheduleSeries) {
  const today = formatDateStr(new Date())
  const firstRevisionDate = series.revisions[0]?.revision.effectiveFrom
  const requestedStart =
    firstRevisionDate != null && firstRevisionDate > today
      ? firstRevisionDate
      : undefined
  const range = buildSchedulePreviewRange(series, requestedStart)
  const endDate =
    series.schedule.endDate == null || series.schedule.endDate > range.endDate
      ? range.endDate
      : series.schedule.endDate

  return endDate < range.startDate
    ? { constraintViolations: [] }
    : evaluateScheduleConstraintViolationsSafely({
        series,
        range: { startDate: range.startDate, endDate },
      })
}

export const scheduleConstraintsApp = new Hono()
  .get('/events/:id/constraints', async (c) => {
    const scheduleId = c.req.param('id')
    const series = await loadScheduleWithRevisions(scheduleId)
    if (!series) return c.json({ error: 'Schedule not found' }, 404)

    return c.json({ constraint: await loadScheduleConstraint(scheduleId) }, 200)
  })
  .put(
    '/events/:id/constraints',
    zValidator('json', scheduleConstraintSchema),
    async (c) => {
      const scheduleId = c.req.param('id')
      const input = c.req.valid('json')
      const { weekdays, ...values } = input
      const updatedAt = new Date()
      const series = await db.transaction(async (tx) => {
        const existingSeries = await loadScheduleWithRevisions(scheduleId, tx)
        if (!existingSeries) return null

        await tx
          .insert(scheduleConstraints)
          .values({ scheduleId, ...values, updatedAt })
          .onConflictDoUpdate({
            target: scheduleConstraints.scheduleId,
            set: { ...values, updatedAt },
          })
        await tx
          .delete(scheduleConstraintWeekdays)
          .where(eq(scheduleConstraintWeekdays.scheduleId, scheduleId))
        if (weekdays.length > 0) {
          await tx
            .insert(scheduleConstraintWeekdays)
            .values(weekdays.map((weekday) => ({ scheduleId, ...weekday })))
        }
        return existingSeries
      })
      if (!series) return c.json({ error: 'Schedule not found' }, 404)

      const constraint = {
        ...input,
        weekdays: [...weekdays].sort(
          (left, right) => left.dayOfWeek - right.dayOfWeek,
        ),
      }
      const evaluation = await evaluateSavedConstraints(series)
      return c.json({ constraint, ...evaluation }, 200)
    },
  )
  .delete('/events/:id/constraints', async (c) => {
    const scheduleId = c.req.param('id')
    const series = await loadScheduleWithRevisions(scheduleId)
    if (!series) return c.json({ error: 'Schedule not found' }, 404)

    await db
      .delete(scheduleConstraints)
      .where(eq(scheduleConstraints.scheduleId, scheduleId))
    return c.body(null, 204)
  })
