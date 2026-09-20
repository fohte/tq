import type { Command } from 'commander'
import { err, ok, Result } from 'neverthrow'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'
import type { AgentProvider } from '#transcript'

interface AgentSessionReference {
  provider: AgentProvider
  sessionId: string
}

// Codex exposes its session id in the shell environment, while Claude Code's
// hook persists its id through CLAUDE_ENV_FILE. Prefer the native Codex value
// when both are present so a nested Codex shell cannot link the Claude session.
function resolveAgentSession(): Result<AgentSessionReference, Error> {
  const codexSessionId = process.env['CODEX_SESSION_ID']
  if (codexSessionId != null && codexSessionId.length > 0) {
    return ok({ provider: 'codex', sessionId: codexSessionId })
  }

  const claudeSessionId = process.env['TQ_SESSION_ID']
  if (claudeSessionId != null && claudeSessionId.length > 0) {
    return ok({ provider: 'claude_code', sessionId: claudeSessionId })
  }

  return err(
    new Error(
      'No agent session ID is set. Run this from within a supported coding agent session with the SessionStart hook configured to run `tq hook SessionStart`.',
    ),
  )
}

async function resolveAgentSessionId(
  client: Client,
  command: Command,
): Promise<string> {
  const session = resolveAgentSession().match(
    (value) => value,
    (error) => fail(command, error),
  )
  const res = await client.api['agent-sessions']['by-session'][':provider'][
    ':sessionId'
  ].$get({
    param: session,
  })
  if (!res.ok) return fail(command, await toApiError(res))
  return (await res.json()).id
}

export function registerLinkCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  program
    .command('link <taskId>')
    .description('Link the current agent session to a task')
    .action(async (taskId: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const agentSessionId = await resolveAgentSessionId(client, command)

      const res = await client.api.tasks[':taskId']['agent-sessions'].$post({
        param: { taskId },
        json: { agentSessionId },
      })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  program
    .command('unlink <taskId>')
    .description('Unlink the current agent session from a task')
    .action(async (taskId: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const agentSessionId = await resolveAgentSessionId(client, command)

      const res = await client.api.tasks[':taskId']['agent-sessions'][
        ':agentSessionId'
      ].$delete({ param: { taskId, agentSessionId } })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson({ unlinked: true, taskId })
    })
}
