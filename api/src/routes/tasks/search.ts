import { zValidator } from '@hono/zod-validator'
import { ilike, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { tasks } from '#db/schema'

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
  // Backs the editor's `#` mention autocomplete: a digit query matches by
  // task number prefix (so `#12` surfaces #12, #120, #123, ...), anything
  // else matches by title substring.
  .get('/mentions', zValidator('query', mentionsQuerySchema), async (c) => {
    const { q, limit } = c.req.valid('query')
    const trimmed = q?.trim() ?? ''

    const condition =
      trimmed === ''
        ? undefined
        : /^\d+$/.test(trimmed)
          ? sql`CAST(${tasks.number} AS TEXT) LIKE ${`${trimmed}%`}`
          : ilike(tasks.title, `%${trimmed}%`)

    const result = await db
      .select({
        id: tasks.id,
        number: tasks.number,
        title: tasks.title,
        status: tasks.status,
      })
      .from(tasks)
      .where(condition)
      .orderBy(tasks.number)
      .limit(limit ?? 10)

    return c.json(result, 200)
  })
