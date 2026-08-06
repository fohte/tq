import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-client'
import { printJson } from '#output'

type LinkJson = InferRequestType<
  Client['api']['tasks'][':taskId']['github-link']['$post']
>['json']

type ResolveJson = InferRequestType<
  Client['api']['github']['resolve']['$post']
>['json']

export function registerGithubCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const github = program.command('github').description('Manage GitHub links')

  github
    .command('link <taskId> <url>')
    .description('Link a task to a GitHub issue or pull request')
    .action(
      async (
        taskId: string,
        url: string,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl)
        const json: LinkJson = { url }
        const res = await client.api.tasks[':taskId']['github-link'].$post({
          param: { taskId },
          json,
        })
        if (!res.ok) throw await toApiError(res)
        printJson(await res.json())
      },
    )

  github
    .command('unlink <taskId>')
    .description("Remove a task's GitHub link")
    .action(async (taskId: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl)
      const res = await client.api.tasks[':taskId']['github-link'].$delete({
        param: { taskId },
      })
      if (!res.ok) throw await toApiError(res)
      printJson({ unlinked: true, taskId })
    })

  github
    .command('sync [taskId]')
    .description(
      "Sync a task's GitHub link, or every linked task if no task is given",
    )
    .action(
      async (
        taskId: string | undefined,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl)

        if (taskId != null) {
          const res = await client.api.tasks[':taskId'][
            'github-link'
          ].sync.$post({ param: { taskId } })
          if (!res.ok) throw await toApiError(res)
          printJson({ synced: true, taskId })
          return
        }

        const res = await client.api.github.sync.$post()
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 204 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) throw await toApiError(res)
        printJson({ synced: true })
      },
    )

  github
    .command('resolve <url>')
    .description(
      'Resolve a GitHub issue/pull request URL to its linked task, or a preview if unlinked',
    )
    .action(async (url: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl)
      const json: ResolveJson = { url }
      const res = await client.api.github.resolve.$post({ json })
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    })
}
