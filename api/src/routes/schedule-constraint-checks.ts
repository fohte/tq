import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { evaluateScheduleConstraintViolations } from '#routes/schedule-constraint-evaluation'
import { loadScheduleWithRevisions } from '#routes/schedule-shared'
import { scheduleConstraintCheckSchema } from '#schemas/schedule-constraint-check'

export const scheduleConstraintChecksApp = new Hono().post(
  '/events/:id/constraint-check',
  zValidator('json', scheduleConstraintCheckSchema),
  async (c) => {
    const series = await loadScheduleWithRevisions(c.req.param('id'))
    if (!series) return c.json({ error: 'Schedule not found' }, 404)

    const { draft, ...range } = c.req.valid('json')
    const evaluation = await evaluateScheduleConstraintViolations({
      series,
      range,
      ...(draft === undefined ? {} : { draft }),
    })

    return c.json(evaluation, 200)
  },
)
