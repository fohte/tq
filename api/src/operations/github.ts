import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'

const githubLinkSchema = z.object({
  taskId: taskIdOrNumber,
  url: z.string().min(1),
})
const githubUnlinkSchema = z.object({
  taskId: taskIdOrNumber,
  linkId: pathSegmentSchema('GitHub link ID'),
})
const githubSyncSchema = z.object({
  taskId: taskIdOrNumber.optional(),
})
const githubResolveSchema = z.object({ url: z.string().min(1) })

export const githubOperations = [
  defineOperation(githubLinkSchema, {
    path: ['github', 'link'],
    description: 'Link a task to a GitHub issue or pull request',
    positionalArgs: ['taskId', 'url'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:taskId/github-link'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, url }) =>
      requestJson(
        client.api.tasks[':taskId']['github-link'].$post({
          param: { taskId: String(taskId) },
          json: { url },
        }),
      ),
  }),
  defineOperation(githubUnlinkSchema, {
    path: ['github', 'unlink'],
    description: "Remove one of a task's GitHub links, by link id",
    positionalArgs: ['taskId', 'linkId'],
    kind: 'delete',
    attribution: 'agent',
    routes: ['DELETE /api/tasks/:taskId/github-link/:linkId'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, linkId }) =>
      requestNoContent(
        client.api.tasks[':taskId']['github-link'][':linkId'].$delete({
          param: {
            taskId: String(taskId),
            linkId: encodePathSegment(linkId),
          },
        }),
      ).map(() => ({ unlinked: true, taskId: String(taskId), linkId })),
  }),
  defineOperation(githubSyncSchema, {
    path: ['github', 'sync'],
    description:
      "Sync a task's GitHub link, or every linked task if no task is given",
    positionalArgs: [{ name: 'taskId', optional: true }],
    kind: 'write',
    routes: [
      'POST /api/tasks/:taskId/github-link/sync',
      'POST /api/github/sync',
    ],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId }) =>
      taskId == null
        ? requestNoContent(client.api.github.sync.$post()).map(() => ({
            synced: true,
          }))
        : requestNoContent(
            client.api.tasks[':taskId']['github-link'].sync.$post({
              param: { taskId: String(taskId) },
            }),
          ).map(() => ({ synced: true, taskId: String(taskId) })),
  }),
  defineOperation(githubResolveSchema, {
    path: ['github', 'resolve'],
    description:
      'Resolve a GitHub issue/pull request URL to its linked task, or a preview if unlinked',
    positionalArgs: ['url'],
    kind: 'read',
    routes: ['POST /api/github/resolve'],
    cli: { output: { kind: 'json' } },
    run: (client, { url }) =>
      requestJson(client.api.github.resolve.$post({ json: { url } })),
  }),
] as const
