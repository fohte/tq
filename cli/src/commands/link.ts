import { linkOperations } from 'api/operations'
import type { Command } from 'commander'
import { err, ok, type Result } from 'neverthrow'

import type { ReadableStdin } from '#input'
import {
  type OperationCommandHandler,
  registerOperations,
} from '#operation-adapter'

const noAgentSessionIdError =
  'No agent session ID is set. Expected CODEX_SESSION_ID for Codex or TQ_SESSION_ID for Claude Code (set by the SessionStart hook configured to run `tq hook SessionStart`).'

type AgentSessionReference = {
  provider: 'codex' | 'claude_code'
  sessionId: string
}

function resolveAgentSession(): Result<AgentSessionReference, Error> {
  // Prefer Codex's native session id so a nested Codex shell does not link the
  // Claude session.
  const codexSessionId = process.env['CODEX_SESSION_ID']
  if (codexSessionId != null && codexSessionId.length > 0) {
    return ok({ provider: 'codex', sessionId: codexSessionId })
  }

  const claudeSessionId = process.env['TQ_SESSION_ID']
  if (claudeSessionId != null && claudeSessionId.length > 0) {
    return ok({ provider: 'claude_code', sessionId: claudeSessionId })
  }

  return err(new Error(noAgentSessionIdError))
}

export function registerLinkCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin = process.stdin,
): void {
  const handler: OperationCommandHandler = async ({ input, execute }) => {
    await execute(() =>
      resolveAgentSession().map((session) => ({ ...input, ...session })),
    )
  }

  for (const operation of linkOperations) {
    registerOperations(
      program,
      [operation],
      operation.description,
      fetchImpl,
      stdin,
      handler,
    )
  }
}
