import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { queryTaskList } from '#routes/tasks/list-query'
import {
  hydrateTaskListRows,
  hydrateTaskListRowsWithoutDescription,
} from '#routes/tasks/shared'
import { listTasksQuerySchema } from '#schemas/task'
import { getTaskQueueCandidateReason } from '#services/task-queue-candidates'

export const tasksListApp = new Hono().get(
  '/',
  zValidator('query', listTasksQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    const result = await queryTaskList(query, {
      includeSearchMatch: query.includeMatch === true,
      prioritizeTitleMatches: query.includeMatch === true,
    })

    const hydratedRows =
      result.view === 'full'
        ? await hydrateTaskListRows(result.rows)
        : await hydrateTaskListRowsWithoutDescription(result.rows)

    return c.json(
      hydratedRows.map((item) => {
        const match = result.matchByTaskId?.get(item.id)
        return {
          ...item,
          ...(query.candidatesOn == null
            ? {}
            : {
                candidateReason: getTaskQueueCandidateReason(
                  item,
                  query.candidatesOn,
                ),
              }),
          ...(match === undefined ? {} : { match }),
          ...(result.ancestorOnlyIds.has(item.id)
            ? { ancestorOnly: true }
            : {}),
        }
      }),
      200,
    )
  },
)
