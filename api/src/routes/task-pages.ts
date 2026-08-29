import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  MAX_HTML_CONTENT_LENGTH,
  MAX_MARKDOWN_CONTENT_LENGTH,
} from '#constants/content-length'
import { db } from '#db/connection'
import { taskPages } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import {
  diffFields,
  type EditAuthorInfo,
  getPageAuthors,
  recordEdit,
} from '#lib/edits'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import { createPageSchema, updatePageSchema } from '#schemas/task-page'
import { syncTaskLinks } from '#services/task-links'

function maxContentLengthFor(format: 'markdown' | 'html'): number {
  return format === 'html'
    ? MAX_HTML_CONTENT_LENGTH
    : MAX_MARKDOWN_CONTENT_LENGTH
}

export function pageToResponse(
  page: typeof taskPages.$inferSelect,
  author: EditAuthorInfo | null = null,
) {
  return {
    id: page.id,
    taskId: page.taskId,
    title: page.title,
    content: page.content,
    format: page.format,
    sortOrder: page.sortOrder,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
    author,
  }
}

export const taskPagesApp = new Hono<TaskEnv>()
  .use('*', async (c, next) => {
    const param = c.req.param('taskId')
    if (param == null) {
      return c.json({ error: 'taskId is required' }, 400)
    }

    const task = await findTaskByIdOrNumber(param)
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    c.set('task', task)
    return next()
  })
  .get('/', async (c) => {
    const taskId = c.get('task').id

    const pages = await db
      .select()
      .from(taskPages)
      .where(eq(taskPages.taskId, taskId))
      .orderBy(taskPages.sortOrder, taskPages.createdAt)

    const authors = await getPageAuthors(pages.map((page) => page.id))

    return c.json(
      pages.map((page) => pageToResponse(page, authors.get(page.id) ?? null)),
      200,
    )
  })
  .post('/', zValidator('json', createPageSchema), async (c) => {
    const taskId = c.get('task').id
    const input = c.req.valid('json')
    const author = c.get('author')
    const format = input.format ?? 'markdown'

    const maxLength = maxContentLengthFor(format)
    if (input.content != null && input.content.length > maxLength) {
      return c.json(
        {
          error: `content must have <=${String(maxLength)} characters for format "${format}"`,
        },
        400,
      )
    }

    const page = await db.transaction(async (tx) => {
      const page = firstOrThrow(
        await tx
          .insert(taskPages)
          .values({
            taskId,
            title: input.title,
            content: input.content ?? '',
            format,
            sortOrder: input.sortOrder ?? 0,
          })
          .returning(),
      )

      await recordEdit(
        tx,
        { taskId, pageId: page.id },
        { action: 'create' },
        author,
      )

      return page
    })

    const linkSync = await syncTaskLinks(taskId)

    return c.json({ ...pageToResponse(page, author), linkSync }, 201)
  })
  .get('/:pageId', async (c) => {
    const taskId = c.get('task').id
    const pageId = c.req.param('pageId')

    const page = await db.query.taskPages.findFirst({
      where: and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)),
    })

    if (!page) {
      return c.json({ error: 'Page not found' }, 404)
    }

    const authors = await getPageAuthors([pageId])

    return c.json(pageToResponse(page, authors.get(pageId) ?? null), 200)
  })
  .patch('/:pageId', zValidator('json', updatePageSchema), async (c) => {
    const taskId = c.get('task').id
    const pageId = c.req.param('pageId')
    const input = c.req.valid('json')
    const author = c.get('author')

    const existing = await db.query.taskPages.findFirst({
      where: and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)),
    })
    if (!existing) {
      return c.json({ error: 'Page not found' }, 404)
    }

    const format = input.format ?? existing.format
    const maxLength = maxContentLengthFor(format)
    if (input.content != null && input.content.length > maxLength) {
      return c.json(
        {
          error: `content must have <=${String(maxLength)} characters for format "${format}"`,
        },
        400,
      )
    }

    const changedFields = diffFields(existing, input, ['title', 'content'])

    const updated = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(taskPages)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)))
        .returning()
      if (!updated) {
        return null
      }

      for (const field of changedFields) {
        await recordEdit(
          tx,
          { taskId, pageId },
          { action: 'update', field },
          author,
        )
      }

      return updated
    })

    if (!updated) {
      return c.json({ error: 'Page not found' }, 404)
    }

    const linkSync =
      'content' in input ? await syncTaskLinks(taskId) : undefined

    const authors = await getPageAuthors([pageId])

    return c.json(
      {
        ...pageToResponse(updated, authors.get(pageId) ?? null),
        ...(linkSync ? { linkSync } : {}),
      },
      200,
    )
  })
  .delete('/:pageId', async (c) => {
    const taskId = c.get('task').id
    const pageId = c.req.param('pageId')

    const deleted = await db
      .delete(taskPages)
      .where(and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)))
      .returning()

    if (deleted.length === 0) {
      return c.json({ error: 'Page not found' }, 404)
    }

    await syncTaskLinks(taskId)

    return c.body(null, 204)
  })
