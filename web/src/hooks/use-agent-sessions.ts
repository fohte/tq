import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type AgentSession = InferResponseType<
  (typeof api.api)['agent-sessions']['$get'],
  200
>[number]

export const agentSessionKeys = {
  all: ['agent-sessions'] as const,
  list: () => [...agentSessionKeys.all, 'list'] as const,
}

export function useAgentSessions() {
  return useQuery({
    queryKey: agentSessionKeys.list(),
    queryFn: async () => {
      const res = await api.api['agent-sessions'].$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}
