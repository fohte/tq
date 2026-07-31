import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertStatus } from '#lib/assert-response'

export type IntegrationSummary = InferResponseType<
  typeof api.api.integrations.$get,
  200
>[number]

const integrationsKeys = {
  list: ['integrations'] as const,
  authUrl: (id: string) => ['integration-auth-url', id] as const,
}

export function useIntegrationsList() {
  return useQuery({
    queryKey: integrationsKeys.list,
    queryFn: async () => {
      const res = await api.api.integrations.$get()
      assertStatus(res, 200)
      return res.json()
    },
    retry: false,
  })
}

export function useIntegrationAuthUrl(id: string, enabled: boolean) {
  return useQuery({
    queryKey: integrationsKeys.authUrl(id),
    queryFn: async () => {
      const res = await api.api.integrations[':id']['auth-url'].$get({
        param: { id },
      })
      assertStatus(res, 200)
      return res.json()
    },
    enabled,
    retry: false,
  })
}

export function useDisconnectIntegrationAccount(providerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await api.api.integrations[':id'].accounts[
        ':accountId'
      ].$delete({ param: { id: providerId, accountId } })
      assertStatus(res, 200)
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationsKeys.list })
    },
  })
}
