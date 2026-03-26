import { db } from '@api/db/connection'
import { taskComments, tasks } from '@api/db/schema'
import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'
import { z } from 'zod'

const createCommentSchema = z.object({
  content: z.string().min(1),
})

const updateCommentSchema = z.object({
  content: z.string().min(1),
})

function commentToResponse(comment: typeof taskComments.$inferSelect) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

const factory = createFactory()

const requireTask = factory.createMiddleware(async (c, next) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guaranteed by route param
  const taskId = c.req.param('taskId')!

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  })
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  return next()
})

export const taskCommentsApp = new Hono()
  .use('/:taskId/comments/*', requireTask)
  .get('/:taskId/comments', async (c) => {
    const taskId = c.req.param('taskId')

    const comments = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt)

    return c.json(comments.map(commentToResponse), 200)
  })
  .post(
    '/:taskId/comments',
    zValidator('json', createCommentSchema),
    async (c) => {
      const taskId = c.req.param('taskId')
      const input = c.req.valid('json')

      const [comment] = await db
        .insert(taskComments)
        .values({
          taskId,
          content: input.content,
        })
        .returning()

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- insert always returns a row
      return c.json(commentToResponse(comment!), 201)
    },
  )
  .patch(
    '/:taskId/comments/:commentId',
    zValidator('json', updateCommentSchema),
    async (c) => {
      const taskId = c.req.param('taskId')
      const commentId = c.req.param('commentId')

      const existing = await db.query.taskComments.findFirst({
        where: and(
          eq(taskComments.id, commentId),
          eq(taskComments.taskId, taskId),
        ),
      })
      if (!existing) {
        return c.json({ error: 'Comment not found' }, 404)
      }

      const input = c.req.valid('json')

      const [updated] = await db
        .update(taskComments)
        .set({ content: input.content, updatedAt: new Date() })
        .where(eq(taskComments.id, commentId))
        .returning()

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- update on existing row always returns
      return c.json(commentToResponse(updated!), 200)
    },
  )
  .delete('/:taskId/comments/:commentId', async (c) => {
    const taskId = c.req.param('taskId')
    const commentId = c.req.param('commentId')

    const existing = await db.query.taskComments.findFirst({
      where: and(
        eq(taskComments.id, commentId),
        eq(taskComments.taskId, taskId),
      ),
    })
    if (!existing) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    await db.delete(taskComments).where(eq(taskComments.id, commentId))

    return c.body(null, 204)
  })
