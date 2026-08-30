import { Command, CommanderError, Option } from 'commander'

import { registerCalendarCommands } from '#commands/calendar'
import { registerCommentCommands } from '#commands/comment'
import { registerGithubCommands } from '#commands/github'
import { registerHealthCommand } from '#commands/health'
import { registerHookCommands } from '#commands/hook'
import { registerImageCommands } from '#commands/image'
import { registerLabelCommands } from '#commands/label'
import { registerLinkCommands } from '#commands/link'
import { registerPageCommands } from '#commands/page'
import { registerProjectCommands } from '#commands/project'
import { registerSavedViewCommands } from '#commands/saved-view'
import { registerSessionCommands } from '#commands/session'
import { registerSlackCommands } from '#commands/slack'
import { registerTaskCommands } from '#commands/task'
import { registerTodayCommands } from '#commands/today'
import { formatError } from '#errors'
import { collectHeader } from '#headers'
import type { ReadableStdin } from '#input'

function buildProgram(
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
      '--web-url <url>',
      'tq web app base URL, for commands that print a web link (or set TQ_WEB_URL; defaults to --api-url, which is the same origin in the production deployment)',
      process.env['TQ_WEB_URL'],
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
  registerSavedViewCommands(program, fetchImpl)
  registerLabelCommands(program, fetchImpl)
  registerImageCommands(program, fetchImpl)
  registerGithubCommands(program, fetchImpl)
  registerTodayCommands(program, fetchImpl)
  registerCalendarCommands(program, fetchImpl)
  registerSlackCommands(program, fetchImpl)
  registerHealthCommand(program, fetchImpl)
  registerHookCommands(program, fetchImpl, stdin)
  registerLinkCommands(program, fetchImpl)
  registerSessionCommands(program, fetchImpl)

  return program
}

export async function runCli(
  argv: readonly string[],
  fetchImpl: typeof fetch = fetch,
  stdin: ReadableStdin = process.stdin,
): Promise<number> {
  const program = buildProgram(fetchImpl, stdin)
  // This is the top-level Result/exception boundary: commander's
  // parseAsync rejects via exceptions (a CommanderError from commander
  // itself, or from Command#error() via cli/src/result.ts's fail()), and
  // this is where CLI exit codes get decided.
  return program.parseAsync(argv, { from: 'user' }).then(
    () => 0,
    (err: unknown) => {
      if (err instanceof CommanderError) {
        return err.exitCode
      }
      process.stderr.write(`Error: ${formatError(err)}\n`)
      return 1
    },
  )
}
