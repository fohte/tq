import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'

type ResolveJson = InferRequestType<
  Client['api']['slack']['resolve']['$post']
>['json']

export function registerSlackCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const slack = program.command('slack').description('Manage Slack links')

  slack
    .command('resolve <url>')
    .description('Resolve a Slack permalink URL to a message preview')
    .action(async (url: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const json: ResolveJson = { url }
      const res = await client.api.slack.resolve.$post({ json })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })
}
