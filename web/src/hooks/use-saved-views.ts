import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import {
  assertOk,
  assertOkOrThrow,
  assertOkWithMessage,
  unwrapOrThrow,
} from '#lib/assert-response'

export type SavedView = InferResponseType<
  (typeof api.api)['saved-views']['$get'],
  200
>[number]

export interface SavedViewFilter {
  q?: string
  context?: 'work' | 'personal'
}

export const savedViewKeys = {
  all: ['saved-views'] as const,
  lists: ['saved-views', 'list'] as const,
  list: (filter?: SavedViewFilter) => [...savedViewKeys.lists, filter] as const,
}

export function useSavedViews(
  filter?: SavedViewFilter,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: savedViewKeys.list(filter),
    queryFn: async () => {
      const res = await api.api['saved-views'].$get({
        query: {
          ...(filter?.q == null ? {} : { q: filter.q }),
          ...(filter?.context == null ? {} : { context: filter.context }),
        },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: options?.enabled ?? true,
  })
}

export interface CreateSavedViewInput {
  name: string
  query: string
}

export function useCreateSavedView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSavedViewInput) => {
      const res = await api.api['saved-views'].$post({ json: input })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedViewKeys.all })
    },
  })
}

export function useRenameSavedView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.api['saved-views'][':id'].$patch({
        param: { id },
        json: { name },
      })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedViewKeys.all })
    },
  })
}

export function useDeleteSavedView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api['saved-views'][':id'].$delete({
        param: { id },
      })
      assertOkOrThrow(res)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedViewKeys.all })
    },
  })
}
