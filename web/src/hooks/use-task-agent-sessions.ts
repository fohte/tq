import { useQuery } from '@tanstack/react-query'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

const taskAgentSessionKeys = {
  all: (taskId: string) =>
    ['tasks', 'detail', taskId, 'agent-sessions'] as const,
}

export function useTaskAgentSessions(taskId: string) {
  return useQuery({
    queryKey: taskAgentSessionKeys.all(taskId),
    queryFn: async () => {
      const res = await api.api.tasks[':taskId']['agent-sessions'].$get({
        param: { taskId },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}
