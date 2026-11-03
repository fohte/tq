import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'
import { prioritySettingsKeys, queueKeys, taskKeys } from '#lib/query-keys'

export type PrioritySetting = InferResponseType<
  (typeof api.api)['priority-settings']['$get'],
  200
>[number]
export type UpdatePrioritySettingsInput = InferRequestType<
  (typeof api.api)['priority-settings']['$put']
>['json']
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

export function useUpdatePrioritySettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: UpdatePrioritySettingsInput) => {
      const res = await api.api['priority-settings'].$put({ json: settings })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(prioritySettingsKeys.all, settings)
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: queueKeys.all })
    },
  })
}
