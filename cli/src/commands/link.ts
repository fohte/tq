import type { Command } from 'commander'
import { err, ok, Result } from 'neverthrow'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'

// Set by `tq hook SessionStart` into CLAUDE_ENV_FILE, so a `tq link`/`tq
// unlink` run from inside a Claude Code session can find its own session_id
// without the caller having to know or pass it.
function resolveSessionId(): Result<string, Error> {
  const sessionId = process.env['TQ_SESSION_ID']
  if (sessionId == null || sessionId.length === 0) {
    return err(
      new Error(
        'TQ_SESSION_ID is not set. Run this from within a Claude Code session with the SessionStart hook configured to run `tq hook SessionStart`.',
      ),
    )
  }
  return ok(sessionId)
}

async function resolveAgentSessionId(
  client: Client,
  command: Command,
): Promise<string> {
  const sessionId = resolveSessionId().match(
    (value) => value,
    (error) => fail(command, error),
  )
  const res = await client.api['agent-sessions']['by-session'][':provider'][
    ':sessionId'
  ].$get({
    param: { provider: 'claude_code', sessionId },
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
    .description('Link the current Claude Code session to a task')
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
    .description('Unlink the current Claude Code session from a task')
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
