import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'

const labelKeys = {
  all: ['labels'] as const,
}

export function useLabels() {
  return useQuery({
    queryKey: labelKeys.all,
    queryFn: async () => {
      const res = await api.api.labels.$get()
      if (!res.ok) throw new Error('Failed to fetch labels') // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- res.ok can be false at runtime
      return res.json()
    },
  })
}
