import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { queryTaskList } from '#routes/tasks/list-query'

const suggestQuerySchema = z.object({
  prefix: z.string(),
  category: z.string().optional(),
})

const mentionsQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const tasksSearchApp = new Hono()
  .get('/search/suggest', zValidator('query', suggestQuerySchema), (c) => {
    const { prefix, category } = c.req.valid('query')

    const allSuggestions: Record<
      string,
      Array<{ value: string; display: string }>
    > = {
      is: [
        { value: 'is:todo', display: 'Todo' },
        { value: 'is:in_progress', display: 'In Progress' },
        { value: 'is:completed', display: 'Completed' },
      ],
      context: [
        { value: 'context:work', display: 'Work' },
        { value: 'context:personal', display: 'Personal' },
      ],
      sort: [
        { value: 'sort:due', display: 'Sort by due date' },
        { value: 'sort:created', display: 'Sort by creation date' },
        { value: 'sort:updated', display: 'Sort by update date' },
        { value: 'sort:estimate', display: 'Sort by estimate' },
      ],
      has: [
        { value: 'has:pages', display: 'Has pages' },
        { value: 'has:comments', display: 'Has comments' },
      ],
    }

    const categories =
      category != null ? [category] : Object.keys(allSuggestions)
    const suggestions = categories.flatMap((cat) =>
      (allSuggestions[cat] ?? [])
        .filter((s) => s.value.startsWith(prefix))
        .map((s) => ({ ...s, category: cat })),
    )

    return c.json(suggestions, 200)
  })
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
