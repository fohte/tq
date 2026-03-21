import { db } from '@api/db/connection'
import { taskPages, tasks } from '@api/db/schema'
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

function pageToResponse(page: typeof taskPages.$inferSelect) {
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

export const taskPagesApp = new Hono()
  .get('/', async (c) => {
    const taskId = c.req.param('taskId')

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
    const taskId = c.req.param('taskId')
    const input = c.req.valid('json')

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    })
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const [page] = await db
      .insert(taskPages)
      .values({
        taskId,
        title: input.title,
        content: input.content ?? '',
        sortOrder: input.sortOrder ?? 0,
      })
      .returning()

    return c.json(pageToResponse(page!), 201)
  })
  .patch('/:pageId', zValidator('json', updatePageSchema), async (c) => {
    const taskId = c.req.param('taskId')
    const pageId = c.req.param('pageId')

    const existing = await db.query.taskPages.findFirst({
      where: and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)),
    })
    if (!existing) {
      return c.json({ error: 'Page not found' }, 404)
    }

    const [updated] = await db
      .update(taskPages)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(taskPages.id, pageId))
      .returning()

    return c.json(pageToResponse(updated!), 200)
  })
  .delete('/:pageId', async (c) => {
    const taskId = c.req.param('taskId')
    const pageId = c.req.param('pageId')

    const existing = await db.query.taskPages.findFirst({
      where: and(eq(taskPages.id, pageId), eq(taskPages.taskId, taskId)),
    })
    if (!existing) {
      return c.json({ error: 'Page not found' }, 404)
    }

    await db.delete(taskPages).where(eq(taskPages.id, pageId))

    return c.body(null, 204)
  })
