import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { timeBlockKeys } from '#hooks/use-time-blocks'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

type TodayTask = InferResponseType<
  (typeof api.api.schedule)['today-tasks']['$get']
>[number]

export type { TodayTask }

const todayTaskKeys = {
  all: ['today-tasks'] as const,
  list: (date: string) => [...todayTaskKeys.all, 'list', date] as const,
}

export function useTodayTasks(date: string) {
  return useQuery({
    queryKey: todayTaskKeys.list(date),
    queryFn: async () => {
      const res = await api.api.schedule['today-tasks'].$get({
        query: { date },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useSetTodayTasks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      date,
      taskIds,
    }: {
      date: string
      taskIds: string[]
    }) => {
      const res = await api.api.schedule['today-tasks'].$put({
        json: { date, taskIds },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSuccess: (data, { date }) => {
      queryClient.setQueryData(todayTaskKeys.list(date), data)
    },
  })
}

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
