import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type TaskAgentSession = InferResponseType<
  (typeof api.api)['agent-sessions']['by-task']['$get'],
  200
>[number]

export function useTaskAgentSessionsByTaskId() {
  return useQuery({
    queryKey: ['agent-sessions', 'by-task'] as const,
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
