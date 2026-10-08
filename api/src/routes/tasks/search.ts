import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { taskPreviewIdSchema } from '#lib/numeric-id'
import { splitCommaList } from '#lib/split-comma-list'
import { numericIdPattern } from '#lib/task-identifier'
import { queryTaskList } from '#routes/tasks/list-query'
import { queryPageSearch } from '#routes/tasks/page-search-query'
import { resolveTasksByIdsOrNumbers } from '#routes/tasks/shared'
import { getSearchQuerySuggestions } from '#search-query-parser'

const suggestQuerySchema = z.object({
  prefix: z.string(),
  category: z.string().optional(),
})

const mentionsQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const pageSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  source: z.enum(['page', 'comment', 'task']).optional(),
})

const taskPreviewQuerySchema = z.object({
  ids: z
    .union([z.string(), z.array(z.string())])
    .transform((values) =>
      (Array.isArray(values) ? values : [values]).flatMap(splitCommaList),
    )
    .pipe(z.array(taskPreviewIdSchema).min(1).max(100)),
})

export const tasksSearchApp = new Hono()
  .get('/preview', zValidator('query', taskPreviewQuerySchema), async (c) => {
    const { ids } = c.req.valid('query')
    const lookupIdByParam = new Map(
      ids.map((id) => [id, numericIdPattern.test(id) ? id : id.toLowerCase()]),
    )
    const { byParam } = await resolveTasksByIdsOrNumbers([
      ...lookupIdByParam.values(),
    ])
    const previews = Object.fromEntries(
      [...lookupIdByParam].flatMap(([id, lookupId]) => {
        const task = byParam.get(lookupId)
        if (task == null) return []

        return [
          [
            id,
            {
              id: task.id,
              number: task.number,
              title: task.title,
              status: task.status,
              statusReason: task.statusReason,
              description: task.description,
            },
          ],
        ]
      }),
    )

    return c.json(previews, 200)
  })
  .get('/search/suggest', zValidator('query', suggestQuerySchema), (c) => {
    const { prefix, category } = c.req.valid('query')
    return c.json(getSearchQuerySuggestions(prefix, category), 200)
  })
  .get(
    '/search/pages',
    zValidator('query', pageSearchQuerySchema),
    async (c) => {
      const { q, limit, source } = c.req.valid('query')
      const results = await queryPageSearch({
        q,
        ...(limit === undefined ? {} : { limit }),
        ...(source === undefined ? {} : { source }),
      })

      return c.json({ results }, 200)
    },
  )
  // Backs the editor's `#` mention autocomplete. Search condition building
  // is shared with GET /api/tasks via queryTaskList; this endpoint only
  // projects the result down to the fields the mention UI needs. Result
  // order follows queryTaskList's default (creation time), not task number.
  .get('/mentions', zValidator('query', mentionsQuerySchema), async (c) => {
    const { q, limit } = c.req.valid('query')

    const { rows } = await queryTaskList({ q, limit: limit ?? 10 })

    return c.json(
      rows.map((r) => ({
        id: r.task.id,
        number: r.task.number,
        title: r.task.title,
        status: r.task.status,
        statusReason: r.task.statusReason,
      })),
      200,
    )
  })
