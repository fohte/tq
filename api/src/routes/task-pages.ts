import { db } from '@api/db/connection'
import { taskPages, tasks } from '@api/db/schema'
import { firstOrThrow } from '@api/lib/drizzle-utils'
import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createPageSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

export function pageToResponse(page: typeof taskPages.$inferSelect) {
  return {
    id: page.id,
    taskId: page.taskId,
    title: page.title,
    content: page.content,
    sortOrder: page.sortOrder,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  }
}

type TaskPagesEnv = {
  Variables: {
    taskId: string
  }
}

export const taskPagesApp = new Hono<TaskPagesEnv>()
  .use('*', async (c, next): Promise<Response | undefined> => {
    const taskId = c.req.param('taskId')
    if (taskId == null) {
      return c.json({ error: 'taskId is required' }, 400)
    }
    c.set('taskId', taskId)
    await next()
  })
  .get('/', async (c) => {
    const taskId = c.get('taskId')

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    })
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const pages = await db
      .select()
      .from(taskPages)
      .where(eq(taskPages.taskId, taskId))
      .orderBy(taskPages.sortOrder, taskPages.createdAt)

    return c.json(pages.map(pageToResponse), 200)
  })
  .post('/', zValidator('json', createPageSchema), async (c) => {
    const taskId = c.get('taskId')
    const input = c.req.valid('json')

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    })
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const page = firstOrThrow(
      await db
        .insert(taskPages)
        .values({
          taskId,
          title: input.title,
          content: input.content ?? '',
          sortOrder: input.sortOrder ?? 0,
        })
        .returning(),
    )

    return c.json(pageToResponse(page), 201)
  })
  .get('/:pageId', async (c) => {
    const taskId = c.get('taskId')
    const pageId = c.req.param('pageId')

    const page = await db.query.taskPages.findFirst({
      where: and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)),
    })

    if (!page) {
      return c.json({ error: 'Page not found' }, 404)
    }

    return c.json(pageToResponse(page), 200)
  })
  .patch('/:pageId', zValidator('json', updatePageSchema), async (c) => {
    const taskId = c.get('taskId')
    const pageId = c.req.param('pageId')

    const [updated] = await db
      .update(taskPages)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)))
      .returning()

    if (!updated) {
      return c.json({ error: 'Page not found' }, 404)
    }

    return c.json(pageToResponse(updated), 200)
  })
  .delete('/:pageId', async (c) => {
    const taskId = c.get('taskId')
    const pageId = c.req.param('pageId')

    const deleted = await db
      .delete(taskPages)
      .where(and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)))
      .returning()

    if (deleted.length === 0) {
      return c.json({ error: 'Page not found' }, 404)
    }

    return c.body(null, 204)
  })
