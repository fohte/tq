import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  type OperationClient,
  parseResponse,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { agentProviderSchema } from '#schemas/agent-session'

const linkInputSchema = z.object({
  taskId: pathSegmentSchema('Task ID'),
  provider: pathSegmentSchema('Provider').pipe(agentProviderSchema),
  sessionId: pathSegmentSchema('Session ID'),
})
const agentSessionSchema = z.object({
  id: pathSegmentSchema('Agent session ID'),
})

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
              param: { taskId: encodePathSegment(taskId) },
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
              param: {
                taskId: encodePathSegment(taskId),
                agentSessionId: encodePathSegment(agentSessionId),
              },
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
      param: {
        provider: encodePathSegment(provider),
        sessionId: encodePathSegment(sessionId),
      },
    }),
  )
    .andThen((value) => parseResponse(agentSessionSchema, value))
    .map((session) => session.id)
}
