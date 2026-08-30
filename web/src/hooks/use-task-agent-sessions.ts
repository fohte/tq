import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type TaskAgentSession = InferResponseType<
  (typeof api.api)['agent-sessions']['by-task']['$get'],
  200
>[number]

// Not nested under use-agent-sessions.ts's agentSessionKeys — that file is
// being edited by a concurrent PR, so this query gets its own key root here.
const taskAgentSessionKeys = {
  all: ['agent-sessions', 'by-task'] as const,
  byTaskId: (taskId: string) =>
    ['tasks', 'detail', taskId, 'agent-sessions'] as const,
}

export function useTaskAgentSessionsByTaskId() {
  return useQuery({
    queryKey: taskAgentSessionKeys.all,
    queryFn: async () => {
      const res = await api.api['agent-sessions']['by-task'].$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
    select: (rows) => {
      const map = new Map<string, TaskAgentSession[]>()
      for (const row of rows) {
        const list = map.get(row.taskId) ?? []
        list.push(row)
        map.set(row.taskId, list)
      }
      return map
    },
  })
}

export function useTaskAgentSessions(taskId: string) {
  return useQuery({
    queryKey: taskAgentSessionKeys.byTaskId(taskId),
    queryFn: async () => {
      const res = await api.api.tasks[':taskId']['agent-sessions'].$get({
        param: { taskId },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}
