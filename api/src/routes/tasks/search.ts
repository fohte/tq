import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { queryTaskList } from '#routes/tasks/list-query'
import { queryPageSearch } from '#routes/tasks/page-search-query'
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
})

export const tasksSearchApp = new Hono()
  .get('/search/suggest', zValidator('query', suggestQuerySchema), (c) => {
    const { prefix, category } = c.req.valid('query')
    return c.json(getSearchQuerySuggestions(prefix, category), 200)
  })
  .get(
    '/search/pages',
    zValidator('query', pageSearchQuerySchema),
    async (c) => {
      const { q, limit } = c.req.valid('query')
      const results = await queryPageSearch({
        q,
        ...(limit === undefined ? {} : { limit }),
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
      })),
      200,
    )
  })
