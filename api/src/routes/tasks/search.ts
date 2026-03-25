import { db } from '@api/db/connection'
import {
  labels,
  taskComments,
  taskLabels,
  taskPages,
  tasks,
} from '@api/db/schema'
import { taskToResponse } from '@api/routes/tasks/shared'
import { parseSearchQuery } from '@api/search-query-parser'
import { zValidator } from '@hono/zod-validator'
import { and, eq, exists, isNotNull, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'completed']).optional(),
  label: z.string().optional(),
  context: z.enum(['work', 'personal', 'dev']).optional(),
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

export const tasksSearchApp = new Hono()
  .get('/search', zValidator('query', searchQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const conditions = []

    // Parse q parameter for prefix-based filters and free text
    const parsed = query.q ? parseSearchQuery(query.q) : null

    // Free text search across title, description, and task_pages.content
    if (parsed?.freeText) {
      const pattern = `%${parsed.freeText}%`
      conditions.push(
        sql`(${tasks.title} ILIKE ${pattern} OR ${tasks.description} ILIKE ${pattern} OR EXISTS (SELECT 1 FROM ${taskPages} WHERE ${taskPages.taskId} = ${tasks.id} AND ${taskPages.content} ILIKE ${pattern}))`,
      )
    }

    // Status filter: from parsed query or explicit param
    const status = parsed?.status ?? query.status
    if (status) {
      conditions.push(eq(tasks.status, status))
    }

    // Context filter: from parsed query or explicit param
    const context = parsed?.context ?? query.context
    if (context) {
      conditions.push(eq(tasks.context, context))
    }

    // Label filter: from parsed query or explicit param
    const labelName = parsed?.label ?? query.label
    if (labelName) {
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
    if (parsed?.hasPages) {
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
    if (parsed?.hasComments) {
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
    if (parsed?.parentId) {
      conditions.push(eq(tasks.parentId, parsed.parentId))
    }

    // project: filter
    if (parsed?.projectId) {
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
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    return c.json(result.map(taskToResponse), 200)
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
        { value: 'context:dev', display: 'Dev' },
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

    const categories = category ? [category] : Object.keys(allSuggestions)
    const suggestions = categories.flatMap((cat) =>
      (allSuggestions[cat] ?? [])
        .filter((s) => s.value.startsWith(prefix))
        .map((s) => ({ ...s, category: cat })),
    )

    return c.json(suggestions, 200)
  })
