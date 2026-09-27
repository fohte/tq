import { healthOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerHealthCommand(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  registerOperations(
    program,
    healthOperations,
    'Check API connectivity',
    fetchImpl,
    stdin,
  )
}
