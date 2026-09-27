import { errAsync, okAsync } from 'neverthrow'
import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  type OperationError,
  requestJson,
  requestNoContent,
} from '#operations/types'

const agentSessionSchema = z.looseObject({ id: z.string() })
const agentSessionByTaskSchema = z.looseObject({
  id: z.string(),
  taskId: z.string(),
  taskNumber: z.number(),
  taskTitle: z.string(),
  taskParentId: z.string().nullable(),
  taskStatus: z.enum(['todo', 'completed']),
})

type AgentSessionByTask = z.output<typeof agentSessionByTaskSchema>

type LinkedTask = {
  id: string
  number: number
  title: string
  parentId: string | null
  status: 'todo' | 'completed'
}

function groupTasksBySessionId(
  rows: AgentSessionByTask[],
): Map<string, LinkedTask[]> {
  const map = new Map<string, LinkedTask[]>()
  for (const row of rows) {
    const list = map.get(row.id) ?? []
    list.push({
      id: row.taskId,
      number: row.taskNumber,
      title: row.taskTitle,
      parentId: row.taskParentId,
      status: row.taskStatus,
    })
    map.set(row.id, list)
  }
  return map
}

function parseResponse<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
) {
  const parsed = schema.safeParse(value)
  return parsed.success
    ? okAsync(parsed.data)
    : errAsync({
        kind: 'request',
        error: parsed.error,
      } satisfies OperationError)
}

const listSessionsInputSchema = z.object({
  sessionId: z
    .array(z.string())
    .describe('Only list the session with this session id')
    .optional(),
})
const deleteSessionInputSchema = z.object({
  provider: pathSegmentSchema('Provider'),
  sessionId: pathSegmentSchema('Session ID'),
})

export const sessionOperations = [
  defineOperation(listSessionsInputSchema, {
    path: ['session', 'list'],
    description: 'List agent sessions with the tasks they are linked to',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/agent-sessions', 'GET /api/agent-sessions/by-task'],
    cli: {
      repeatableOptions: ['sessionId'],
      output: {
        kind: 'list',
        omitKey: 'lastMessage',
        fullOption: '--full',
        fullDescription: "Include the session's last message in the output",
      },
    },
    run: (client, { sessionId }) => {
      const query = sessionId == null ? {} : { sessionId }
      const sessions = requestJson(
        client.api['agent-sessions'].$get({ query }),
      ).andThen((value) => parseResponse(z.array(agentSessionSchema), value))
      const sessionsByTask = requestJson(
        client.api['agent-sessions']['by-task'].$get(),
      ).andThen((value) =>
        parseResponse(z.array(agentSessionByTaskSchema), value),
      )

      return sessions.andThen((sessionRows) =>
        sessionsByTask.map((taskRows) => {
          const tasksBySessionId = groupTasksBySessionId(taskRows)
          return sessionRows.map((session) => ({
            ...session,
            tasks: tasksBySessionId.get(session.id) ?? [],
          }))
        }),
      )
    },
  }),
  defineOperation(deleteSessionInputSchema, {
    path: ['session', 'delete'],
    description:
      'Delete an agent session by provider and session id, e.g. when an external session manager knows the session will never resume',
    positionalArgs: ['provider', 'sessionId'],
    kind: 'delete',
    routes: ['DELETE /api/agent-sessions/by-session/:provider/:sessionId'],
    cli: { output: { kind: 'json' } },
    run: (client, { provider, sessionId }) =>
      requestNoContent(
        client.api['agent-sessions']['by-session'][':provider'][
          ':sessionId'
        ].$delete({
          param: {
            provider: encodePathSegment(provider),
            sessionId: encodePathSegment(sessionId),
          },
        }),
      ).map(() => ({ deleted: true, provider, sessionId })),
  }),
] as const
