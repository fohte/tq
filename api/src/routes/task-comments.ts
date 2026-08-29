import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'

import { db } from '#db/connection'
import { taskComments } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { type EditAuthorInfo, getCommentAuthors, recordEdit } from '#lib/edits'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import { createCommentSchema, updateCommentSchema } from '#schemas/task-comment'
import { syncTaskLinks } from '#services/task-links'

function commentToResponse(
  comment: typeof taskComments.$inferSelect,
  author: EditAuthorInfo | null = null,
) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author,
  }
}

const factory = createFactory<TaskEnv, '/:taskId/comments'>()

const requireTask = factory.createMiddleware(async (c, next) => {
  const task = await findTaskByIdOrNumber(c.req.param('taskId'))
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  c.set('task', task)
  return next()
})

export const taskCommentsApp = new Hono<TaskEnv>()
  .use('/:taskId/comments/*', requireTask)
  .get('/:taskId/comments', async (c) => {
    const taskId = c.get('task').id

    const comments = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt)

    const authors = await getCommentAuthors(comments.map((c) => c.id))

    return c.json(
      comments.map((c) => commentToResponse(c, authors.get(c.id) ?? null)),
      200,
    )
  })
  .post(
    '/:taskId/comments',
    zValidator('json', createCommentSchema),
    async (c) => {
      const taskId = c.get('task').id
      const input = c.req.valid('json')
      const author = c.get('author')

      const comment = await db.transaction(async (tx) => {
        const comment = firstOrThrow(
          await tx
            .insert(taskComments)
            .values({
              taskId,
              content: input.content,
            })
            .returning(),
        )

        await recordEdit(
          tx,
          { taskId, commentId: comment.id },
          { action: 'create' },
          author,
        )

        return comment
      })

      const linkSync = await syncTaskLinks(taskId)

      return c.json({ ...commentToResponse(comment, author), linkSync }, 201)
    },
  )
  .patch(
    '/:taskId/comments/:commentId',
    zValidator('json', updateCommentSchema),
    async (c) => {
      const taskId = c.get('task').id
      const commentId = c.req.param('commentId')
      const author = c.get('author')

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
      const contentChanged = input.content !== existing.content

      const updated = await db.transaction(async (tx) => {
        const updated = firstOrThrow(
          await tx
            .update(taskComments)
            .set({ content: input.content, updatedAt: new Date() })
            .where(eq(taskComments.id, commentId))
            .returning(),
        )

        if (contentChanged) {
          await recordEdit(
            tx,
            { taskId, commentId },
            { action: 'update', field: 'content' },
            author,
          )
        }

        return updated
      })

      const linkSync = await syncTaskLinks(taskId)

      const authors = await getCommentAuthors([commentId])

      return c.json(
        {
          ...commentToResponse(updated, authors.get(commentId) ?? null),
          linkSync,
        },
        200,
      )
    },
  )
  .delete('/:taskId/comments/:commentId', async (c) => {
    const taskId = c.get('task').id
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

    await syncTaskLinks(taskId)

    return c.body(null, 204)
  })
