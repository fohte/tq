import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type AgentSession = InferResponseType<
  (typeof api.api)['agent-sessions']['$get'],
  200
>[number]

export { isAgentSessionActive } from 'api/lib/agent-session-activity'

const agentSessionKeys = {
  all: ['agent-sessions'] as const,
  list: () => [...agentSessionKeys.all, 'list'] as const,
}

export function useUpdateAgentSessionCustomLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      customLabel,
    }: {
      id: string
      customLabel: string | null
    }) => {
      const res = await api.api['agent-sessions'][':id'].$patch({
        param: { id },
        json: { customLabel },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, customLabel }) => {
      await queryClient.cancelQueries({ queryKey: agentSessionKeys.list() })

      const previousList = queryClient.getQueryData<AgentSession[]>(
        agentSessionKeys.list(),
      )

      queryClient.setQueryData<AgentSession[]>(agentSessionKeys.list(), (old) =>
        old?.map((session) =>
          session.id === id ? { ...session, customLabel } : session,
        ),
      )

      return { previousList }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(agentSessionKeys.list(), context.previousList)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: agentSessionKeys.all })
    },
  })
}
