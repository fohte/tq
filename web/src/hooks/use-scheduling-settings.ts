import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk } from '#lib/assert-response'

export type SchedulingSettings = InferResponseType<
  (typeof api.api)['scheduling-settings']['$get'],
  200
>

export type UpdateSchedulingSettingsInput = InferRequestType<
  (typeof api.api)['scheduling-settings']['$patch']
>['json']

const schedulingSettingsKeys = {
  detail: ['scheduling-settings'] as const,
}

export function useSchedulingSettings() {
  return useQuery({
    queryKey: schedulingSettingsKeys.detail,
    queryFn: async () => {
      const res = await api.api['scheduling-settings'].$get()
      assertOk(res)
      return res.json()
    },
  })
}

export function useUpdateSchedulingSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateSchedulingSettingsInput) => {
      const res = await api.api['scheduling-settings'].$patch({ json: input })
      assertOk(res)
      return res.json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: schedulingSettingsKeys.detail,
      })
    },
  })
}
