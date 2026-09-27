import { sessionOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerSessionCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin = process.stdin,
): void {
  registerOperations(
    program,
    sessionOperations,
    'Manage agent sessions',
    fetchImpl,
    stdin,
  )
}
