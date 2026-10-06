import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { queryTaskList } from '#routes/tasks/list-query'
import { hydrateTaskListRows } from '#routes/tasks/shared'
import { listTasksQuerySchema } from '#schemas/task'

export const tasksListApp = new Hono().get(
  '/',
  zValidator('query', listTasksQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    const { rows, ancestorOnlyIds, matchByTaskId } = await queryTaskList(
      query,
      {
        includeSearchMatch: query.includeMatch === true,
        prioritizeTitleMatches: query.includeMatch === true,
      },
    )

    const hydratedRows = await hydrateTaskListRows(rows)

    return c.json(
      hydratedRows.map((item) => {
        const match = matchByTaskId?.get(item.id)
        return {
          ...item,
          ...(match === undefined ? {} : { match }),
          ...(ancestorOnlyIds.has(item.id) ? { ancestorOnly: true } : {}),
        }
      }),
      200,
    )
  },
)
