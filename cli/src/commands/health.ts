import type { Command } from 'commander'

import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'

export function registerHealthCommand(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  program
    .command('health')
    .description('Check API connectivity')
    .action(async (_options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.health.$get()
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })
}
