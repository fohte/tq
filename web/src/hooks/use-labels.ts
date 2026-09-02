import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type Label = InferResponseType<typeof api.api.labels.$get, 200>[number]

export interface LabelFilter {
  context?: 'work' | 'personal'
}

export const labelKeys = {
  all: ['labels'] as const,
  list: (filter?: LabelFilter) => [...labelKeys.all, filter] as const,
}

export function useLabels(filter?: LabelFilter) {
  return useQuery({
    queryKey: labelKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.labels.$get({
        query: filter?.context ? { context: filter.context } : {},
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}
