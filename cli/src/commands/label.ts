import type { Command } from 'commander'

import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { unwrap } from '#result'

export function registerLabelCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const label = program.command('label').description('Manage labels')

  label
    .command('list')
    .description('List labels')
    .action(async (_options: unknown, command: Command) => {
      const client = unwrap(buildClient(command, fetchImpl))
      const res = await client.api.labels.$get()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    })
}
