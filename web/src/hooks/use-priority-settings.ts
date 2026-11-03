import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'
import { prioritySettingsKeys } from '#lib/query-keys'

export type PrioritySetting = InferResponseType<
  (typeof api.api)['priority-settings']['$get'],
  200
>[number]
export type TaskPriority = number | null

export function usePrioritySettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: prioritySettingsKeys.all,
    queryFn: async () => {
      const res = await api.api['priority-settings'].$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  })
}
