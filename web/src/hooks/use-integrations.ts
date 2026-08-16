import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertStatus, unwrapOrThrow } from '#lib/assert-response'

export type IntegrationSummary = InferResponseType<
  typeof api.api.integrations.$get,
  200
>[number]

// A provider can accept a new/another account when it's configured and
// either supports multiple accounts, or has none connected yet — the single
// source of truth for whether to offer a "connect"/"add account" action.
export function canConnectIntegration(summary: IntegrationSummary): boolean {
  return (
    summary.configured &&
    (summary.supportsMultipleAccounts || summary.accounts.length === 0)
  )
}

const integrationsKeys = {
  list: ['integrations'] as const,
  authUrl: (id: string) => ['integration-auth-url', id] as const,
}

export function useIntegrationsList() {
  return useQuery({
    queryKey: integrationsKeys.list,
    queryFn: async () => {
      const res = await api.api.integrations.$get()
      return unwrapOrThrow(assertStatus(res, 200)).json()
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
      return unwrapOrThrow(assertStatus(res, 200)).json()
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
      return unwrapOrThrow(assertStatus(res, 200)).json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationsKeys.list })
    },
  })
}
