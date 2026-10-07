import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  omitKeyRecursively,
  parseResponse,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { listAgentSessionsQuerySchema } from '#schemas/agent-session'

const agentSessionSchema = z.looseObject({ id: z.string() })
const agentSessionListSchema = agentSessionSchema.refine(
  (session): session is typeof session & { sessionId: string } =>
    typeof session['sessionId'] === 'string',
)
const agentSessionByTaskSchema = z.looseObject({
  id: z.string(),
  taskId: z.string(),
  taskNumber: z.number(),
  taskTitle: z.string(),
  taskParentId: z.string().nullable(),
  taskStatus: z.enum(['todo', 'completed']),
  linkedAt: z.iso.datetime(),
})

type AgentSessionByTask = z.output<typeof agentSessionByTaskSchema>

type LinkedTask = {
  id: string
  number: number
  title: string
  parentId: string | null
  status: 'todo' | 'completed'
  linkedAt: string
}

const DEFAULT_SESSION_LIST_LIMIT = 20

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
      linkedAt: row.linkedAt,
    })
    map.set(row.id, list)
  }
  return map
}

const listSessionsInputSchema = z.object({
  sessionId: z
    .array(z.string())
    .describe('Only list the session with this session id')
    .optional(),
  limit: listAgentSessionsQuerySchema.shape.limit
    .describe(
      `Maximum number of sessions to return (1-100 or unlimited). Defaults to ${String(DEFAULT_SESSION_LIST_LIMIT)}.`,
    )
    .optional(),
  full: z.boolean().optional().describe("Include each session's last message"),
})
const sessionRefInputSchema = z.object({
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
      group: { description: 'Manage agent sessions', order: 15 },
      repeatableOptions: ['sessionId'],
      optionDefaults: { limit: String(DEFAULT_SESSION_LIST_LIMIT) },
      output: {
        kind: 'list',
        omitKey: 'lastMessage',
        fullOption: '--full',
        fullDescription: "Include the session's last message in the output",
        fullField: 'full',
      },
    },
    run: (client, { sessionId, limit, full }) => {
      const query = {
        limit: String(limit ?? DEFAULT_SESSION_LIST_LIMIT),
        ...(sessionId == null ? {} : { sessionId }),
      }
      const sessions = requestJson(
        client.api['agent-sessions'].$get({ query }),
      ).andThen((value) =>
        parseResponse(z.array(agentSessionListSchema), value),
      )

      return sessions.andThen((sessionRows) => {
        const sessionIds =
          limit === 'unlimited'
            ? sessionId
            : sessionRows.map((session) => session.sessionId)
        const sessionsByTask = requestJson(
          client.api['agent-sessions']['by-task'].$get({
            query: {
              ...(sessionIds == null ? {} : { sessionId: sessionIds }),
              taskIds: 'all',
              active: 'all',
              limit: 'unlimited',
            },
          }),
        ).andThen((value) =>
          parseResponse(z.array(agentSessionByTaskSchema), value),
        )

        return sessionsByTask.map((taskRows) => {
          const tasksBySessionId = groupTasksBySessionId(taskRows)
          const sessionsWithTasks = sessionRows.map((session) => ({
            ...session,
            tasks: tasksBySessionId.get(session.id) ?? [],
          }))
          return full === true
            ? sessionsWithTasks
            : omitKeyRecursively(sessionsWithTasks, 'lastMessage')
        })
      })
    },
  }),
  defineOperation(sessionRefInputSchema, {
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
  defineOperation(sessionRefInputSchema, {
    path: ['session', 'archive'],
    description: 'Archive an agent session by provider and session id',
    positionalArgs: ['provider', 'sessionId'],
    kind: 'write',
    routes: [
      'POST /api/agent-sessions/by-session/:provider/:sessionId/archive',
    ],
    cli: { output: { kind: 'json' } },
    run: (client, { provider, sessionId }) =>
      requestJson(
        client.api['agent-sessions']['by-session'][':provider'][':sessionId'][
          'archive'
        ].$post({
          param: {
            provider: encodePathSegment(provider),
            sessionId: encodePathSegment(sessionId),
          },
        }),
      )
        .andThen((value) => parseResponse(agentSessionSchema, value))
        .map(() => ({ archived: true, provider, sessionId })),
  }),
] as const
