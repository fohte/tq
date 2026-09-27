import { errAsync, okAsync } from 'neverthrow'
import { z } from 'zod'

import {
  defineOperation,
  type OperationClient,
  type OperationError,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { agentProviderSchema } from '#schemas/agent-session'

const linkInputSchema = z.object({
  taskId: z.string(),
  provider: agentProviderSchema,
  sessionId: z.string().min(1),
})
const agentSessionSchema = z.object({ id: z.string() })

const surface = {
  only: 'cli',
  reason:
    'The MCP server runs remotely and cannot read the local environment variables used to identify the current agent session.',
} as const

export const linkOperations = [
  defineOperation(linkInputSchema, {
    path: ['link', 'link'],
    description: 'Link the current agent session to a task',
    positionalArgs: ['taskId'],
    kind: 'write',
    routes: [
      'GET /api/agent-sessions/by-session/:provider/:sessionId',
      'POST /api/tasks/:taskId/agent-sessions',
    ],
    surface,
    cli: {
      path: ['link'],
      hiddenFields: ['provider', 'sessionId'],
      output: { kind: 'json' },
    },
    run: (client, { taskId, provider, sessionId }) =>
      requestAgentSessionId(client, provider, sessionId).andThen(
        (agentSessionId) =>
          requestJson(
            client.api.tasks[':taskId']['agent-sessions'].$post({
              param: { taskId },
              json: { agentSessionId },
            }),
          ),
      ),
  }),
  defineOperation(linkInputSchema, {
    path: ['link', 'unlink'],
    description: 'Unlink the current agent session from a task',
    positionalArgs: ['taskId'],
    kind: 'delete',
    routes: [
      'GET /api/agent-sessions/by-session/:provider/:sessionId',
      'DELETE /api/tasks/:taskId/agent-sessions/:agentSessionId',
    ],
    surface,
    cli: {
      path: ['unlink'],
      hiddenFields: ['provider', 'sessionId'],
      output: { kind: 'json' },
    },
    run: (client, { taskId, provider, sessionId }) =>
      requestAgentSessionId(client, provider, sessionId).andThen(
        (agentSessionId) =>
          requestNoContent(
            client.api.tasks[':taskId']['agent-sessions'][
              ':agentSessionId'
            ].$delete({
              param: { taskId, agentSessionId },
            }),
          ).map(() => ({ unlinked: true, taskId })),
      ),
  }),
] as const

function requestAgentSessionId(
  client: OperationClient,
  provider: z.output<typeof agentProviderSchema>,
  sessionId: string,
) {
  return requestJson(
    client.api['agent-sessions']['by-session'][':provider'][':sessionId'].$get({
      param: { provider, sessionId },
    }),
  ).andThen((value) => {
    const parsed = agentSessionSchema.safeParse(value)
    return parsed.success
      ? okAsync(parsed.data.id)
      : errAsync({
          kind: 'request',
          error: parsed.error,
        } satisfies OperationError)
  })
}
