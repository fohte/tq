import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, assertOkOrThrow, unwrapOrThrow } from '#lib/assert-response'

export type SyncRule = InferResponseType<
  (typeof api.api.github)['sync-rules']['$get'],
  200
>[number]

const githubSyncRuleKeys = {
  list: ['github-sync-rules'] as const,
}

export function useGithubSyncRules() {
  return useQuery({
    queryKey: githubSyncRuleKeys.list,
    queryFn: async () => {
      const res = await api.api.github['sync-rules'].$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export interface CreateGithubSyncRuleInput {
  scope: 'all' | 'org' | 'repo'
  org?: string
  repo?: string
  targetProjectId: string
  includeExisting?: boolean
}

export function useCreateGithubSyncRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateGithubSyncRuleInput) => {
      const res = await api.api.github['sync-rules'].$post({ json: input })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: githubSyncRuleKeys.list })
    },
  })
}

export interface UpdateGithubSyncRuleInput {
  enabled?: boolean
  targetProjectId?: string
}

export function useUpdateGithubSyncRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateGithubSyncRuleInput
    }) => {
      const res = await api.api.github['sync-rules'][':id'].$patch({
        param: { id },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: githubSyncRuleKeys.list })
    },
  })
}

export function useDeleteGithubSyncRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.github['sync-rules'][':id'].$delete({
        param: { id },
      })
      assertOkOrThrow(res)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: githubSyncRuleKeys.list })
    },
  })
}
