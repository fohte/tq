import { errAsync } from 'neverthrow'
import { z } from 'zod'

import {
  defineOperation,
  formatInputIssues,
  requestJson,
} from '#operations/types'
import {
  agentProviderSchema,
  upsertAgentSessionSchema,
} from '#schemas/agent-session'

const hookInputSchema = z.object({
  ...upsertAgentSessionSchema.shape,
  event: z.string(),
  provider: agentProviderSchema
    .describe('Agent reporting this session')
    .optional(),
})

// `event` and the fields sourced from the local hook payload are assembled by
// the CLI handler. The MCP server cannot read local stdin, transcripts, or
// Claude Code's environment file.
export const hookOperations = [
  defineOperation(hookInputSchema, {
    path: ['hook', 'report'],
    description:
      'Report a coding agent hook event (SessionStart, Stop, SessionEnd) to tq, reading the hook JSON payload from stdin. Never fails: a broken connection or malformed input is swallowed silently so it never blocks the agent.',
    positionalArgs: ['event'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/agent-sessions'],
    surface: {
      only: 'cli',
      reason:
        "The CLI reads hook JSON from local stdin, resolves a local transcript, and writes TQ_SESSION_ID to Claude Code's local environment file; the remote MCP server cannot access these local sources.",
    },
    cli: {
      path: ['hook'],
      hiddenFields: ['sessionId', 'cwd', 'label', 'lastMessage', 'ended'],
      envDefaults: {
        context: 'TQ_CONTEXT',
        parentSessionId: 'TQ_PARENT_SESSION_ID',
      },
      optionDefaults: { provider: 'claude_code' },
      output: { kind: 'none' },
    },
    run: (client, input) => {
      const payload = upsertAgentSessionSchema.safeParse({
        ...input,
        provider: input.provider ?? 'claude_code',
      })
      if (!payload.success) {
        return errAsync({
          kind: 'input',
          message: formatInputIssues(payload.error),
        })
      }

      return requestJson(
        client.api['agent-sessions'].$post({
          json: payload.data,
        }),
      )
    },
  }),
] as const
