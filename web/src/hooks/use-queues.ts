import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { todayTaskKeys } from '#hooks/use-today-tasks'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

/** The day queue's key, also used by /api/schedule/today-tasks (see below). */
const DAY_QUEUE_KEY = 'day'

export type Queue = InferResponseType<
  (typeof api.api.queues)['$get'],
  200
>[number]

export type QueueItem = InferResponseType<
  (typeof api.api.queues)[':key']['items']['$get'],
  200
>[number]

export const queueKeys = {
  all: ['queues'] as const,
  items: (key: string, date: string) =>
    [...queueKeys.all, key, 'items', date] as const,
}

export function useQueues() {
  return useQuery({
    queryKey: queueKeys.all,
    queryFn: async () => {
      const res = await api.api.queues.$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

/**
 * One items query per queue, in the same order as `queues` — the caller
 * indexes `queues[i]` against the returned `[i]` to pair a queue definition
 * with its items. Needed because `useQueues()`'s result determines how many
 * queues there are, so a fixed number of `useQuery` calls can't cover it
 * (rules of hooks forbid calling hooks in a loop with a dynamic count).
 */
export function useQueueItemsForQueues(
  queues: Queue[] | undefined,
  date: string,
) {
  return useQueries({
    queries: (queues ?? []).map((queue) => ({
      queryKey: queueKeys.items(queue.key, date),
      queryFn: async () => {
        const res = await api.api.queues[':key'].items.$get({
          param: { key: queue.key },
          query: { date },
        })
        return unwrapOrThrow(assertOk(res)).json()
      },
    })),
  })
}

export function useSetQueueItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      key,
      date,
      taskIds,
    }: {
      key: string
      date: string
      taskIds: string[]
    }) => {
      const res = await api.api.queues[':key'].items.$put({
        param: { key },
        json: { date, taskIds },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSuccess: (data, { key, date }) => {
      queryClient.setQueryData(queueKeys.items(key, date), data)
      // /today and the status line still read the day queue through the
      // older /api/schedule/today-tasks cache key — invalidate it too so a
      // day-queue edit from here doesn't leave them stale.
      if (key === DAY_QUEUE_KEY) {
        void queryClient.invalidateQueries({
          queryKey: todayTaskKeys.list(date),
        })
      }
    },
  })
}
