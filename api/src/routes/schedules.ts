import { recurrenceRuleSchema } from '@api/schemas/recurrence-rule'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const timePattern = /^\d{2}:\d{2}$/

const createTimeBlockSchema = z.object({
  taskId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable().optional(),
  isAutoScheduled: z.boolean().optional(),
})

const updateTimeBlockSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().nullable().optional(),
  isAutoScheduled: z.boolean().optional(),
})

const timeBlockDateQuerySchema = z.object({
  date: z.string(),
})

const todayTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()),
})

const autoAssignSchema = z.object({
  date: z.string(),
})

const createScheduleSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern),
  recurrence: recurrenceRuleSchema.optional(),
  context: z.enum(['work', 'personal', 'dev']).optional(),
  color: z.string().optional(),
})

const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  startTime: z.string().regex(timePattern).optional(),
  endTime: z.string().regex(timePattern).optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
  context: z.enum(['work', 'personal', 'dev']).nullable().optional(),
  color: z.string().nullable().optional(),
})

const scheduleDateQuerySchema = z.object({
  date: z.string(),
})

export const schedulesApp = new Hono()
  // TimeBlock endpoints
  .post('/time-blocks', zValidator('json', createTimeBlockSchema), (c) => {
    // TODO: implement time block creation
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/time-blocks', zValidator('query', timeBlockDateQuerySchema), (c) => {
    // TODO: implement time block listing by date
    return c.json([], 200)
  })
  .patch('/time-blocks/:id', zValidator('json', updateTimeBlockSchema), (c) => {
    // TODO: implement time block update
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .delete('/time-blocks/:id', (c) => {
    // TODO: implement time block deletion
    void c.req.param('id')
    return c.json(null, 501)
  })
  // Today tasks endpoints
  .put('/today-tasks', zValidator('json', todayTasksSchema), (c) => {
    // TODO: implement today tasks update
    return c.json([], 200)
  })
  // Auto-assign endpoint
  .post('/auto-assign', zValidator('json', autoAssignSchema), (c) => {
    // TODO: implement auto-assign
    return c.json([], 200)
  })
  // Recurring schedule (ScheduleBlock) endpoints
  .post('/recurring', zValidator('json', createScheduleSchema), (c) => {
    // TODO: implement recurring schedule creation
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/recurring', zValidator('query', scheduleDateQuerySchema), (c) => {
    // TODO: implement recurring schedule listing by date
    return c.json([], 200)
  })
  .patch('/recurring/:id', zValidator('json', updateScheduleSchema), (c) => {
    // TODO: implement recurring schedule update
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .delete('/recurring/:id', (c) => {
    // TODO: implement recurring schedule deletion
    void c.req.param('id')
    return c.json(null, 501)
  })
