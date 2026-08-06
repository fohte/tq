import { Command, CommanderError, Option } from 'commander'

import { registerCommentCommands } from '#commands/comment'
import { registerLabelCommands } from '#commands/label'
import { registerPageCommands } from '#commands/page'
import { registerProjectCommands } from '#commands/project'
import { ApiError } from '#errors'
import { collectHeader } from '#headers'
import type { ReadableStdin } from '#input'

export function buildProgram(
  fetchImpl: typeof fetch = fetch,
  stdin: ReadableStdin = process.stdin,
): Command {
  const program = new Command()
    .name('tq')
    .description('Command-line client for the tq REST API')
    .exitOverride()
    .option(
      '--api-url <url>',
      'tq API base URL (or set TQ_API_URL)',
      process.env['TQ_API_URL'],
    )
    .addOption(
      new Option(
        '-H, --header <name:value>',
        'Extra header to send with each request (repeatable)',
      )
        .argParser(collectHeader)
        .default({}),
    )

  registerPageCommands(program, fetchImpl, stdin)
  registerCommentCommands(program, fetchImpl, stdin)
  registerProjectCommands(program, fetchImpl)
  registerLabelCommands(program, fetchImpl)

  return program
}

export async function runCli(
  argv: readonly string[],
  fetchImpl: typeof fetch = fetch,
  stdin: ReadableStdin = process.stdin,
): Promise<number> {
  const program = buildProgram(fetchImpl, stdin)
  try {
    await program.parseAsync(argv, { from: 'user' })
    return 0
  } catch (err) {
    if (err instanceof CommanderError) {
      return err.exitCode
    }
    process.stderr.write(`Error: ${formatError(err)}\n`)
    return 1
  }
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    return `${err.message} (HTTP ${String(err.status)})`
  }
  return err instanceof Error ? err.message : String(err)
}
