import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type AgentSession = InferResponseType<
  (typeof api.api)['agent-sessions']['$get'],
  200
>[number]

// `lastActiveAt` only advances on the Stop hook (end of a turn), so a gap of
// a few minutes between turns is normal; a gap this large means the session
// stopped producing turns, not that the user is slow to reply. No telemetry
// backs this cutoff yet — adjust if real usage data suggests a better number.
const STALE_THRESHOLD_MS = 30 * 60_000

/** A session is active when it hasn't ended and hasn't gone stale (see `agentSessions` schema doc). */
export function isAgentSessionActive(
  session: AgentSession,
  now: Date = new Date(),
): boolean {
  return (
    session.endedAt == null &&
    now.getTime() - new Date(session.lastActiveAt).getTime() <
      STALE_THRESHOLD_MS
  )
}

export const agentSessionKeys = {
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
