import type { Command } from 'commander'

import { toApiError } from '#client'
import { buildClient } from '#command-client'
import { printJson } from '#output'

export function registerHealthCommand(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  program
    .command('health')
    .description('Check API connectivity')
    .action(async (_options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl)
      const res = await client.health.$get()
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    })
}
