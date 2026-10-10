import { zValidator } from '@hono/zod-validator'
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  MAX_HTML_CONTENT_LENGTH,
  MAX_MARKDOWN_CONTENT_LENGTH,
} from '#constants/content-length'
import { db } from '#db/connection'
import { taskPages } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import {
  diffFields,
  type EditAuthorInfo,
  getPageAuthors,
  recordEdit,
} from '#lib/edits'
import {
  getOutgoingTaskLinkIds,
  getTaskLinkChangeEventIds,
} from '#routes/tasks/change-event-task-ids'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import { createPageSchema, updatePageSchema } from '#schemas/task-page'
import { syncTaskLinks } from '#services/task-links'

function maxContentLengthFor(format: 'markdown' | 'html'): number {
  return format === 'html'
    ? MAX_HTML_CONTENT_LENGTH
    : MAX_MARKDOWN_CONTENT_LENGTH
}

// Validates the content that will actually end up on the row after this
// write, not just the content present in the request: a PATCH that changes
// only `format` (e.g. html -> markdown) keeps the existing, unvalidated
// content, so checking `input.content` alone would let an oversized string
// through under the new, stricter format.
function validateContentLength(
  content: string,
  format: 'markdown' | 'html',
): { error: string } | null {
  const maxLength = maxContentLengthFor(format)
  return content.length > maxLength
    ? {
        error: `content must have <=${String(maxLength)} characters for format "${format}"`,
      }
    : null
}

function pageToResponse(
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

type TaskPageListRow = Pick<
  typeof taskPages.$inferSelect,
  'id' | 'taskId' | 'title' | 'format' | 'sortOrder' | 'createdAt' | 'updatedAt'
> & {
  preview: string | null
  contentTruncated: boolean
}

export function taskPageListSelection() {
  return {
    id: taskPages.id,
    taskId: taskPages.taskId,
    title: taskPages.title,
    format: taskPages.format,
    sortOrder: taskPages.sortOrder,
    createdAt: taskPages.createdAt,
    updatedAt: taskPages.updatedAt,
    preview: sql<string | null>`
      CASE
        WHEN ${taskPages.format} = 'markdown'
        THEN left(${taskPages.content}, 500)
        ELSE NULL
      END
    `.as('preview'),
    contentTruncated: sql<boolean>`char_length(${taskPages.content}) > 500`.as(
      'contentTruncated',
    ),
  }
}

export function pageToListResponse(
  page: TaskPageListRow,
  author: EditAuthorInfo | null = null,
) {
  return {
    id: page.id,
    taskId: page.taskId,
    title: page.title,
    format: page.format,
    sortOrder: page.sortOrder,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
    author,
    preview: page.preview,
    contentTruncated: page.contentTruncated,
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
      .select(taskPageListSelection())
      .from(taskPages)
      .where(eq(taskPages.taskId, taskId))
      .orderBy(taskPages.sortOrder, taskPages.createdAt)

    const authors = await getPageAuthors(pages.map((page) => page.id))

    return c.json(
      pages.map((page) =>
        pageToListResponse(page, authors.get(page.id) ?? null),
      ),
      200,
    )
  })
  .post('/', zValidator('json', createPageSchema), async (c) => {
    const taskId = c.get('task').id
    const previousTaskLinkIds = await getOutgoingTaskLinkIds(taskId)
    const input = c.req.valid('json')
    const author = c.get('author')
    const format = input.format ?? 'markdown'
    const content = input.content ?? ''

    const lengthError = validateContentLength(content, format)
    if (lengthError) {
      return c.json(lengthError, 400)
    }

    const page = await db.transaction(async (tx) => {
      const page = firstOrThrow(
        await tx
          .insert(taskPages)
          .values({
            taskId,
            title: input.title,
            content,
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
    setChangeEventTaskIds(
      c,
      getTaskLinkChangeEventIds(
        taskId,
        previousTaskLinkIds,
        linkSync.outgoing.map(({ id }) => id),
        true,
      ),
    )

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
    const previousTaskLinkIds =
      'content' in input ? await getOutgoingTaskLinkIds(taskId) : []

    const format = input.format ?? existing.format
    const content = input.content ?? existing.content

    const lengthError = validateContentLength(content, format)
    if (lengthError) {
      return c.json(lengthError, 400)
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
    setChangeEventTaskIds(
      c,
      getTaskLinkChangeEventIds(
        taskId,
        previousTaskLinkIds,
        linkSync?.outgoing.map(({ id }) => id) ?? [],
        true,
      ),
    )

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
    const previousTaskLinkIds = await getOutgoingTaskLinkIds(taskId)

    const deleted = await db
      .delete(taskPages)
      .where(and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)))
      .returning()

    if (deleted.length === 0) {
      return c.json({ error: 'Page not found' }, 404)
    }

    const linkSync = await syncTaskLinks(taskId)
    setChangeEventTaskIds(
      c,
      getTaskLinkChangeEventIds(
        taskId,
        previousTaskLinkIds,
        linkSync.outgoing.map(({ id }) => id),
        true,
      ),
    )

    return c.body(null, 204)
  })
