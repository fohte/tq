import { slackOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerSlackCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin = process.stdin,
): void {
  registerOperations(
    program,
    slackOperations,
    'Manage Slack links',
    fetchImpl,
    stdin,
  )
}
