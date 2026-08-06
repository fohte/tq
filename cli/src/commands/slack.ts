import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-client'
import { printJson } from '#output'

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
      const client = buildClient(command, fetchImpl)
      const json: ResolveJson = { url }
      const res = await client.api.slack.resolve.$post({ json })
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    })
}
