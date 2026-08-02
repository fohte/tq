import { zValidator } from '@hono/zod-validator'
import { and, eq, exists, ilike, isNotNull, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { labels, taskComments, taskLabels, taskPages, tasks } from '#db/schema'
import {
  contextEnum,
  parentTasks,
  taskStatus,
  taskWithParentNumberToResponse,
} from '#routes/tasks/shared'
import { parseSearchQuery } from '#search-query-parser'

const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: taskStatus.optional(),
  label: z.string().optional(),
  context: contextEnum.optional(),
  hasEstimate: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  hasDue: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(['due', 'created', 'updated', 'estimate']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const suggestQuerySchema = z.object({
  prefix: z.string(),
  category: z.string().optional(),
})

const mentionsQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const tasksSearchApp = new Hono()
  .get('/search', zValidator('query', searchQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const conditions = []

    // Parse q parameter for prefix-based filters and free text
    const parsed = query.q != null ? parseSearchQuery(query.q) : null

    // Free text search across title, description, and task_pages.content
    if (parsed?.freeText != null && parsed.freeText !== '') {
      const pattern = `%${parsed.freeText}%`
      conditions.push(
        sql`(${tasks.title} ILIKE ${pattern} OR ${tasks.description} ILIKE ${pattern} OR EXISTS (SELECT 1 FROM ${taskPages} WHERE ${taskPages.taskId} = ${tasks.id} AND ${taskPages.content} ILIKE ${pattern}))`,
      )
    }

    // Status filter: from parsed query or explicit param
    const status = parsed?.status ?? query.status
    if (status != null) {
      conditions.push(eq(tasks.status, status))
    }

    // Context filter: from parsed query or explicit param
    const context = parsed?.context ?? query.context
    if (context != null) {
      conditions.push(eq(tasks.context, context))
    }

    // Label filter: from parsed query or explicit param
    const labelName = parsed?.label ?? query.label
    if (labelName != null) {
      conditions.push(
        exists(
          db
            .select({ _: sql`1` })
            .from(taskLabels)
            .innerJoin(labels, eq(taskLabels.labelId, labels.id))
            .where(
              and(eq(taskLabels.taskId, tasks.id), eq(labels.name, labelName)),
            ),
        ),
      )
    }

    // has:pages filter
    if (parsed?.hasPages === true) {
      conditions.push(
        exists(
          db
            .select({ _: sql`1` })
            .from(taskPages)
            .where(eq(taskPages.taskId, tasks.id)),
        ),
      )
    }

    // has:comments filter
    if (parsed?.hasComments === true) {
      conditions.push(
        exists(
          db
            .select({ _: sql`1` })
            .from(taskComments)
            .where(eq(taskComments.taskId, tasks.id)),
        ),
      )
    }

    // parent: filter
    if (parsed?.parentId != null) {
      conditions.push(eq(tasks.parentId, parsed.parentId))
    }

    // project: filter
    if (parsed?.projectId != null) {
      conditions.push(eq(tasks.projectId, parsed.projectId))
    }

    // Explicit query params (backward compatibility)
    if (query.hasEstimate === true) {
      conditions.push(isNotNull(tasks.estimatedMinutes))
    } else if (query.hasEstimate === false) {
      conditions.push(isNull(tasks.estimatedMinutes))
    }
    if (query.hasDue === true) {
      conditions.push(isNotNull(tasks.dueDate))
    } else if (query.hasDue === false) {
      conditions.push(isNull(tasks.dueDate))
    }

    // Sort order: from parsed query or explicit param
    const sortBy = parsed?.sortBy ?? query.sortBy
    const orderBy = (() => {
      switch (sortBy) {
        case 'due':
          return tasks.dueDate
        case 'created':
          return tasks.createdAt
        case 'updated':
          return tasks.updatedAt
        case 'estimate':
          return tasks.estimatedMinutes
        default:
          return tasks.createdAt
      }
    })()

    const limit = query.limit ?? 20
    const offset = query.offset ?? 0

    const result = await db
      .select({ task: tasks, parentNumber: parentTasks.number })
      .from(tasks)
      .leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    return c.json(
      result.map((r) => taskWithParentNumberToResponse(r.task, r.parentNumber)),
      200,
    )
  })
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
