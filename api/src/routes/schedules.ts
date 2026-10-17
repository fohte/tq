import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { firstOrThrow } from '#lib/drizzle-utils'
import { scheduleConstraintChecksApp } from '#routes/schedule-constraint-checks'
import { evaluateSavedScheduleConstraintViolations } from '#routes/schedule-constraint-evaluation'
import { scheduleConstraintsApp } from '#routes/schedule-constraints'
import {
  expandScheduleForDate,
  formatDateStr,
  getScheduleRevisionForDate,
  recurrenceRuleToResponse,
  type ScheduleRevisionWithRule,
  type ScheduleSeries,
} from '#routes/schedule-expansion'
import { scheduleOverridesApp } from '#routes/schedule-overrides'
import {
  createScheduleSeries,
  deleteScheduleSeries,
  updateScheduleSeries,
} from '#routes/schedule-revisions'
import {
  loadScheduleOverridesForExpansion,
  loadSchedulesWithRules,
} from '#routes/schedule-shared'
import { scheduleTimeBlocksApp } from '#routes/schedule-time-blocks'
import {
  createScheduleSchema,
  scheduleDateRangeSchema,
  updateScheduleSchema,
} from '#schemas/schedule'

function scheduleToResponse(
  series: ScheduleSeries,
  revision: ScheduleRevisionWithRule,
) {
  const firstRevision = firstOrThrow(series.revisions)

  return {
    id: series.schedule.id,
    title: series.schedule.title,
    startDate: firstRevision.revision.effectiveFrom,
    endDate: series.schedule.endDate,
    startTime: revision.revision.startTime,
    endTime: revision.revision.endTime,
    remindBeforeMinutes: series.schedule.remindBeforeMinutes,
    recurrence: recurrenceRuleToResponse(revision.rule),
    context: series.schedule.context,
    color: series.schedule.color,
    createdAt: series.schedule.createdAt.toISOString(),
    updatedAt: series.schedule.updatedAt.toISOString(),
  }
}

async function scheduleToResponseWithConstraints(
  series: ScheduleSeries,
  revision: ScheduleRevisionWithRule,
) {
  const response = scheduleToResponse(series, revision)
  const evaluation = await evaluateSavedScheduleConstraintViolations(
    series,
    revision.revision.effectiveFrom,
  )

  return { ...response, ...evaluation }
}

export const schedulesApp = new Hono()
  .route('/', scheduleTimeBlocksApp)
  .post('/events', zValidator('json', createScheduleSchema), async (c) => {
    const input = c.req.valid('json')
    const series = await createScheduleSeries(input)
    const initialRevision = firstOrThrow(series.revisions)

    return c.json(
      await scheduleToResponseWithConstraints(series, initialRevision),
      201,
    )
  })
  .get('/events', zValidator('query', scheduleDateRangeSchema), async (c) => {
    const { startDate, endDate } = c.req.valid('query')
    const scheduleSeries = await loadSchedulesWithRules()

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
      scheduleSeries.flatMap((series) =>
        expandScheduleForDate(
          series,
          dateStr,
          overridesBySchedule.get(series.schedule.id),
        ).map((block) => ({
          ...block,
          recurrence: recurrenceRuleToResponse(
            getScheduleRevisionForDate(series.revisions, block.occurrenceDate)
              ?.rule ?? null,
          ),
        })),
      ),
    )

    return c.json(expanded, 200)
  })
  .patch('/events/:id', zValidator('json', updateScheduleSchema), async (c) => {
    const result = await updateScheduleSeries(
      c.req.param('id'),
      c.req.valid('json'),
    )
    if (result.kind === 'missing') {
      return c.json({ error: 'Schedule not found' }, 404)
    }
    if (result.kind === 'invalid') {
      return c.json({ error: result.message }, 422)
    }
    if (result.kind === 'dryRun') {
      return c.json(result.preview, 200)
    }

    return c.json(
      await scheduleToResponseWithConstraints(
        result.series,
        result.responseRevision,
      ),
      200,
    )
  })
  .delete('/events/:id', async (c) => {
    const deleted = await deleteScheduleSeries(c.req.param('id'))
    if (!deleted) {
      return c.json({ error: 'Schedule not found' }, 404)
    }

    return c.body(null, 204)
  })
  .route('/', scheduleConstraintsApp)
  .route('/', scheduleConstraintChecksApp)
  .route('/', scheduleOverridesApp)
