import { githubOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import { registerOperations } from '#operation-adapter'

export function registerGithubCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin = process.stdin,
): void {
  registerOperations(
    program,
    githubOperations,
    'Manage GitHub links',
    fetchImpl,
    stdin,
  )
}
