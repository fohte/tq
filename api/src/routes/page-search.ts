import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { taskPages, tasks } from '#db/schema'
import { contextEnum } from '#schemas/task'

const MAX_QUERY_TERMS = 20
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const MATCH_CONTEXT_LENGTH = 80

const pageSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  context: contextEnum.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function findMatch(
  content: string,
  terms: string[],
): { term: string; excerpt: string } {
  const normalizedContent = content.toLocaleLowerCase()
  const firstMatch = terms
    .map((term) => ({
      term,
      start: normalizedContent.indexOf(term.toLocaleLowerCase()),
    }))
    .filter((match) => match.start >= 0)
    .sort((a, b) => a.start - b.start)[0]

  if (!firstMatch) {
    return {
      term: terms[0] ?? '',
      excerpt: content.slice(0, MATCH_CONTEXT_LENGTH * 2),
    }
  }

  const excerptStart = Math.max(0, firstMatch.start - MATCH_CONTEXT_LENGTH)
  const excerptEnd = Math.min(
    content.length,
    firstMatch.start + firstMatch.term.length + MATCH_CONTEXT_LENGTH,
  )

  const prefix = excerptStart > 0 ? '…' : ''
  const suffix = excerptEnd < content.length ? '…' : ''

  return {
    term: firstMatch.term,
    excerpt: `${prefix}${content.slice(excerptStart, excerptEnd)}${suffix}`,
  }
}

export const pageSearchApp = new Hono().get(
  '/search',
  zValidator('query', pageSearchQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    const terms = query.q
      .split(/\s+/)
      .filter((term) => term !== '')
      .slice(0, MAX_QUERY_TERMS)
    const conditions = terms.map((term) => {
      const pattern = `%${escapeLikePattern(term)}%`
      return sql`${taskPages.content} ILIKE ${pattern} ESCAPE '\\'`
    })

    if (query.context != null) {
      conditions.push(eq(tasks.context, query.context))
    }

    const results = await db
      .select({
        page: {
          id: taskPages.id,
          taskId: taskPages.taskId,
          title: taskPages.title,
          content: taskPages.content,
          format: taskPages.format,
          sortOrder: taskPages.sortOrder,
          createdAt: taskPages.createdAt,
          updatedAt: taskPages.updatedAt,
        },
        task: {
          id: tasks.id,
          number: tasks.number,
          title: tasks.title,
          context: tasks.context,
        },
      })
      .from(taskPages)
      .innerJoin(tasks, eq(taskPages.taskId, tasks.id))
      .where(and(...conditions))
      .orderBy(desc(taskPages.updatedAt), taskPages.id)
      .limit(query.limit ?? DEFAULT_LIMIT)
      .offset(query.offset ?? 0)

    return c.json(
      results.map(({ page, task }) => ({
        page: {
          id: page.id,
          taskId: page.taskId,
          title: page.title,
          format: page.format,
          sortOrder: page.sortOrder,
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
        },
        task,
        match: findMatch(page.content, terms),
      })),
      200,
    )
  },
)
