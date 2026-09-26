import { projectOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerProjectCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  registerOperations(
    program,
    projectOperations,
    'Manage projects',
    fetchImpl,
    stdin,
  )
}
