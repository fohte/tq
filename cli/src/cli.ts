import { Command, CommanderError, Option } from 'commander'

import { registerCalendarCommands } from '#commands/calendar'
import { registerCommentCommands } from '#commands/comment'
import { registerGithubCommands } from '#commands/github'
import { registerHealthCommand } from '#commands/health'
import { registerImageCommands } from '#commands/image'
import { registerLabelCommands } from '#commands/label'
import { registerPageCommands } from '#commands/page'
import { registerProjectCommands } from '#commands/project'
import { registerSlackCommands } from '#commands/slack'
import { registerTaskCommands } from '#commands/task'
import { registerTodayCommands } from '#commands/today'
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
    .option(
      '--author <name>',
      'Attribute writes to this LLM agent, e.g. "claude-opus-5" (or set TQ_AUTHOR); sent as X-Author: llm:<name>',
      process.env['TQ_AUTHOR'],
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
  registerTaskCommands(program, fetchImpl)
  registerCommentCommands(program, fetchImpl, stdin)
  registerProjectCommands(program, fetchImpl)
  registerLabelCommands(program, fetchImpl)
  registerImageCommands(program, fetchImpl)
  registerGithubCommands(program, fetchImpl)
  registerTodayCommands(program, fetchImpl)
  registerCalendarCommands(program, fetchImpl)
  registerSlackCommands(program, fetchImpl)
  registerHealthCommand(program, fetchImpl)

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
