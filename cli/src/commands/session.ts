import type { Command } from 'commander'
import type { InferRequestType, InferResponseType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson, printJsonList } from '#output'
import { fail } from '#result'

type AgentSession = InferResponseType<
  Client['api']['agent-sessions']['$get'],
  200
>[number]

type ListAgentSessionsQuery = InferRequestType<
  Client['api']['agent-sessions']['$get']
>['query']

type AgentSessionByTask = InferResponseType<
  Client['api']['agent-sessions']['by-task']['$get'],
  200
>[number]

interface LinkedTask {
  id: string
  number: number
  title: string
  parentId: string | null
}

function collectSessionId(value: string, previous: string[]): string[] {
  return [...previous, value]
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
    })
    map.set(row.id, list)
  }
  return map
}

export function registerSessionCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const session = program
    .command('session')
    .description('Manage agent sessions')

  session
    .command('list')
    .description('List agent sessions with the tasks they are linked to')
    .option(
      '--session-id <id>',
      'Only list the session with this session id (repeatable)',
      collectSessionId,
      [] as string[],
    )
    .option('--full', 'Include lastMessage in the output')
    .action(
      async (
        options: { sessionId: string[]; full?: boolean },
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )

        const query: ListAgentSessionsQuery =
          options.sessionId.length > 0 ? { sessionId: options.sessionId } : {}
        const [sessionsRes, byTaskRes] = await Promise.all([
          client.api['agent-sessions'].$get({ query }),
          client.api['agent-sessions']['by-task'].$get(),
        ])
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!sessionsRes.ok) return fail(command, await toApiError(sessionsRes))
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!byTaskRes.ok) return fail(command, await toApiError(byTaskRes))
        const sessions: AgentSession[] = await sessionsRes.json()
        const byTask: AgentSessionByTask[] = await byTaskRes.json()

        const tasksBySessionId = groupTasksBySessionId(byTask)
        printJsonList(
          sessions.map((s) => ({
            ...s,
            tasks: tasksBySessionId.get(s.id) ?? [],
          })),
          'lastMessage',
          { full: options.full },
        )
      },
    )

  session
    .command('delete <provider> <sessionId>')
    .description(
      'Delete an agent session by provider and session id, e.g. when an external session manager knows the session will never resume',
    )
    .action(
      async (
        provider: string,
        sessionId: string,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )

        const res = await client.api['agent-sessions']['by-session'][
          ':provider'
        ][':sessionId'].$delete({
          param: { provider, sessionId },
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson({ deleted: true, provider, sessionId })
      },
    )
}
