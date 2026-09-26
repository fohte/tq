import { commentOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerCommentCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  registerOperations(
    program,
    commentOperations,
    'Manage comments',
    fetchImpl,
    stdin,
  )
}
