import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { createCommentSchema, updateCommentSchema } from '#schemas/task-comment'

const listCommentsSchema = z.object({ taskId: taskIdOrNumber })
const createCommentInputSchema = createCommentSchema.extend({
  taskId: taskIdOrNumber,
})
const updateCommentInputSchema = updateCommentSchema.extend({
  taskId: taskIdOrNumber,
  commentId: z.string(),
})
const deleteCommentSchema = z.object({
  taskId: taskIdOrNumber,
  commentId: z.string(),
})

export const commentOperations = [
  defineOperation(listCommentsSchema, {
    path: ['comment', 'list'],
    description: 'List comments for a task.',
    positionalArgs: ['taskId'],
    kind: 'read',
    routes: ['GET /api/tasks/:taskId/comments'],
    cli: {
      output: {
        kind: 'list',
        omitKey: 'content',
        fullOption: '--full',
        fullDescription: 'Include full comment content in the output',
      },
    },
    run: (client, { taskId }) =>
      requestJson(
        client.api.tasks[':taskId'].comments.$get({
          param: { taskId: String(taskId) },
        }),
      ),
  }),
  defineOperation(createCommentInputSchema, {
    path: ['comment', 'create'],
    description: 'Add a comment to a task.',
    positionalArgs: ['taskId'],
    kind: 'write',
    routes: ['POST /api/tasks/:taskId/comments'],
    cli: {
      contentInputField: 'content',
      contentRequiredMessage:
        'Comment content is required. Provide --file <path> or pipe content via stdin.',
      output: { kind: 'json-with-link-sync' },
    },
    run: (client, { taskId, content }) =>
      requestJson(
        client.api.tasks[':taskId'].comments.$post({
          param: { taskId: String(taskId) },
          json: { content },
        }),
      ),
  }),
  defineOperation(updateCommentInputSchema, {
    path: ['comment', 'update'],
    description: 'Update the content of an existing comment.',
    positionalArgs: ['taskId', 'commentId'],
    kind: 'write',
    routes: ['PATCH /api/tasks/:taskId/comments/:commentId'],
    cli: {
      contentInputField: 'content',
      contentRequiredMessage:
        'Comment content is required. Provide --file <path> or pipe content via stdin.',
      output: { kind: 'json-with-link-sync' },
    },
    run: (client, { taskId, commentId, content }) =>
      requestJson(
        client.api.tasks[':taskId'].comments[':commentId'].$patch({
          param: { taskId: String(taskId), commentId },
          json: { content },
        }),
      ),
  }),
  defineOperation(deleteCommentSchema, {
    path: ['comment', 'delete'],
    description: 'Delete a comment from a task.',
    positionalArgs: ['taskId', 'commentId'],
    kind: 'delete',
    routes: ['DELETE /api/tasks/:taskId/comments/:commentId'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, commentId }) =>
      requestNoContent(
        client.api.tasks[':taskId'].comments[':commentId'].$delete({
          param: { taskId: String(taskId), commentId },
        }),
      ).map(() => ({ deleted: true, taskId: String(taskId), commentId })),
  }),
] as const

export type OperationRoutes =
  (typeof commentOperations)[number]['routes'][number]
