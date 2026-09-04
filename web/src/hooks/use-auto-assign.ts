import { useMutation, useQueryClient } from '@tanstack/react-query'

import { timeBlockKeys } from '#hooks/use-time-blocks'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export function useAutoAssign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      date,
      tzOffset,
    }: {
      date: string
      tzOffset?: number
    }) => {
      const res = await api.api.schedule['auto-assign'].$post({
        json: { date, tzOffset },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: timeBlockKeys.all })
    },
  })
}
