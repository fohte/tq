import { linkOperations } from 'api/operations'
import type { Command } from 'commander'

import type { ReadableStdin } from '#input'
import {
  type OperationCommandHandler,
  registerOperations,
} from '#operation-adapter'
import { fail } from '#result'

const noAgentSessionIdError =
  'No agent session ID is set. Expected CODEX_SESSION_ID for Codex or TQ_SESSION_ID for Claude Code (set by the SessionStart hook configured to run `tq hook SessionStart`).'

function resolveAgentSession(command: Command): {
  provider: 'codex' | 'claude_code'
  sessionId: string
} {
  // Prefer Codex's native session id so a nested Codex shell does not link the
  // Claude session.
  const codexSessionId = process.env['CODEX_SESSION_ID']
  if (codexSessionId != null && codexSessionId.length > 0) {
    return { provider: 'codex', sessionId: codexSessionId }
  }

  const claudeSessionId = process.env['TQ_SESSION_ID']
  if (claudeSessionId != null && claudeSessionId.length > 0) {
    return { provider: 'claude_code', sessionId: claudeSessionId }
  }

  return fail(command, new Error(noAgentSessionIdError))
}

export function registerLinkCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin = process.stdin,
): void {
  const handler: OperationCommandHandler = async ({
    actionCommand,
    clientResult,
    input,
    execute,
  }) => {
    clientResult.match(
      () => undefined,
      (error) => fail(actionCommand, error),
    )
    await execute({ ...input, ...resolveAgentSession(actionCommand) })
  }

  registerOperations(
    program,
    [linkOperations[0]],
    'Link the current agent session to a task',
    fetchImpl,
    stdin,
    handler,
  )
  registerOperations(
    program,
    [linkOperations[1]],
    'Unlink the current agent session from a task',
    fetchImpl,
    stdin,
    handler,
  )
}
