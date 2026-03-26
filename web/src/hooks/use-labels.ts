import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertOk } from '@web/lib/assert-response'

const labelKeys = {
  all: ['labels'] as const,
}

export function useLabels() {
  return useQuery({
    queryKey: labelKeys.all,
    queryFn: async () => {
      const res = await api.api.labels.$get()
      assertOk(res)
      return res.json()
    },
  })
}
