import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { scheduleConstraints, scheduleConstraintWeekdays } from '#db/schema'
import {
  evaluateSavedScheduleConstraintViolations,
  loadScheduleConstraint,
} from '#routes/schedule-constraint-evaluation'
import { loadScheduleWithRevisions } from '#routes/schedule-shared'
import { scheduleConstraintSchema } from '#services/schedule-constraints'

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
      const evaluation = await evaluateSavedScheduleConstraintViolations(
        series,
        series.revisions[0]?.revision.effectiveFrom,
      )
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
