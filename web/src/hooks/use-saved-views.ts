import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type SavedView = InferResponseType<
  (typeof api.api)['saved-views']['$get'],
  200
>[number]

export const savedViewKeys = {
  all: ['saved-views'] as const,
  lists: ['saved-views', 'list'] as const,
  list: () => [...savedViewKeys.lists] as const,
}

export function useSavedViews() {
  return useQuery({
    queryKey: savedViewKeys.list(),
    queryFn: async () => {
      const res = await api.api['saved-views'].$get({ query: {} })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}
