import { pageOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerPageCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  registerOperations(
    program,
    pageOperations,
    'Manage task pages',
    fetchImpl,
    stdin,
  )
}
