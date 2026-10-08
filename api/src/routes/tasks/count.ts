import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { queryTaskCount } from '#routes/tasks/list-query'
import { countTasksQuerySchema } from '#schemas/task'

export const tasksCountApp = new Hono().get(
  '/count',
  zValidator('query', countTasksQuerySchema),
  async (c) => {
    const count = await queryTaskCount(c.req.valid('query'))
    return c.json({ count }, 200)
  },
)
