import { useQuery } from '@tanstack/react-query'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export const labelKeys = {
  all: ['labels'] as const,
}

export function useLabels() {
  return useQuery({
    queryKey: labelKeys.all,
    queryFn: async () => {
      const res = await api.api.labels.$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}
