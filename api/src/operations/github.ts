import { z } from 'zod'

import { GITHUB_NOTIFY_EVENTS } from '#db/schema'
import { taskIdOrNumber } from '#lib/numeric-id'
import { splitCommaList } from '#lib/split-comma-list'
import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'

const githubLinkSchema = z.object({
  taskId: taskIdOrNumber,
  url: z.string().min(1),
  notifyEvents: z.array(z.enum(GITHUB_NOTIFY_EVENTS)).optional(),
})
const githubUnlinkSchema = z.object({
  taskId: taskIdOrNumber,
  linkId: pathSegmentSchema('GitHub link ID'),
})
const githubSyncSchema = z.object({
  taskId: taskIdOrNumber.optional(),
})
const githubResolveSchema = z.object({ url: z.string().min(1) })
const githubNotifyEventSchema = z.enum(GITHUB_NOTIFY_EVENTS)
type GithubNotifyEvent = z.infer<typeof githubNotifyEventSchema>
const githubNotifyEventsSchema = z
  .string()
  .transform((raw, context): GithubNotifyEvent[] => {
    if (raw === 'off') return []

    const parsed = z
      .array(githubNotifyEventSchema)
      .min(1)
      .safeParse(splitCommaList(raw))
    if (parsed.success) return parsed.data

    context.addIssue({
      code: 'custom',
      message: `Expected comma-separated events (${GITHUB_NOTIFY_EVENTS.join(', ')}) or off`,
    })
    return z.NEVER
  })
const githubNotifySchema = z.object({
  taskId: taskIdOrNumber,
  linkId: pathSegmentSchema('GitHub link ID'),
  events: githubNotifyEventsSchema,
})

export const githubOperations = [
  defineOperation(githubLinkSchema, {
    path: ['github', 'link'],
    description:
      'Link a task to a GitHub issue or pull request. Notification events default by link role if omitted.',
    positionalArgs: ['taskId', 'url'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:taskId/github-link'],
    cli: {
      group: { description: 'Manage GitHub links', order: 7 },
      commaSeparatedOptions: ['notifyEvents'],
      optionNames: { notifyEvents: 'notify' },
      optionDescriptions: {
        notifyEvents:
          'Comma-separated GitHub events to receive notifications for (defaults by link role)',
      },
      optionMetavars: { notifyEvents: 'events' },
      output: { kind: 'json' },
    },
    run: (client, { taskId, url, notifyEvents }) =>
      requestJson(
        client.api.tasks[':taskId']['github-link'].$post({
          param: { taskId: String(taskId) },
          json: {
            url,
            ...(notifyEvents === undefined ? {} : { notifyEvents }),
          },
        }),
      ),
  }),
  defineOperation(githubNotifySchema, {
    path: ['github', 'notify'],
    description:
      "Set the GitHub notification events for one of a task's links with a comma-separated list of closed, reopened, comments, or other, or off to disable notifications",
    positionalArgs: ['taskId', 'linkId', 'events'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/tasks/:taskId/github-link/:linkId'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, linkId, events }) =>
      requestJson(
        client.api.tasks[':taskId']['github-link'][':linkId'].$patch({
          param: {
            taskId: String(taskId),
            linkId: encodePathSegment(linkId),
          },
          json: { notifyEvents: events },
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
