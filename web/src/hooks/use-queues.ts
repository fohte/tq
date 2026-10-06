import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import type { PlanValue } from '#components/task/create-task-modal-fields'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'
import { queueKeys } from '#lib/query-keys'

export { queueKeys }

// The focus view addresses the today queue by key — see routes/today.tsx.
export const DAY_QUEUE_KEY = 'day'

// The only other queue the PLAN field writes to; unlike DAY_QUEUE_KEY, no
// backend code depends on this name specifically.
export const WEEK_QUEUE_KEY = 'week'

export type Queue = InferResponseType<
  (typeof api.api.queues)['$get'],
  200
>[number]

export type QueueItem = InferResponseType<
  (typeof api.api.queues)[':key']['items']['$get'],
  200
>[number]

export async function fetchQueueItems(
  key: string,
  date: string,
): Promise<QueueItem[]> {
  const res = await api.api.queues[':key'].items.$get({
    param: { key },
    query: { date },
  })
  return unwrapOrThrow(assertOk(res)).json()
}

export function useQueues(refetchInterval?: number) {
  return useQuery({
    queryKey: queueKeys.all,
    ...(refetchInterval === undefined ? {} : { refetchInterval }),
    queryFn: async () => {
      const res = await api.api.queues.$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useQueueItems(
  key: string,
  date: string,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled

  return useQuery({
    queryKey: queueKeys.items(key, date),
    queryFn: () => fetchQueueItems(key, date),
    // exactOptionalPropertyTypes rejects `enabled: undefined` since Enabled
    // itself doesn't include undefined, so the key must be omitted entirely
    // to fall back to react-query's default (enabled).
    ...(enabled === undefined ? {} : { enabled }),
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
  refetchInterval?: number,
) {
  return useQueries({
    queries: (queues ?? []).map((queue) => ({
      queryKey: queueKeys.items(queue.key, date),
      ...(refetchInterval === undefined ? {} : { refetchInterval }),
      queryFn: () => fetchQueueItems(queue.key, date),
    })),
  })
}

export function useQueueItemsForDates(
  key: string | undefined,
  dates: string[],
  refetchInterval?: number,
) {
  return useQueries({
    queries:
      key == null
        ? []
        : dates.map((date) => ({
            queryKey: queueKeys.items(key, date),
            ...(refetchInterval === undefined ? {} : { refetchInterval }),
            queryFn: () => fetchQueueItems(key, date),
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
    onSuccess: (_data, { key, date }) => {
      // PUT responses follow request order, while queue reads follow due date.
      void queryClient.invalidateQueries({
        queryKey: queueKeys.items(key, date),
      })
    },
  })
}

interface TaskPlanPosition {
  index: number
  total: number
}

export function queueKeyForPlan(plan: PlanValue | ''): string {
  return plan === 'day' ? DAY_QUEUE_KEY : WEEK_QUEUE_KEY
}

/**
 * Whether a task is in today's queue, this week's queue, or neither ('' when
 * the corresponding queue data hasn't loaded yet either), plus its position
 * within that queue (for a "3rd of 5" hint) and a setter that adds, moves, or
 * removes it. Today and this week are mutually exclusive — PUT
 * /api/queues/:key/items auto-evicts a task from any other queue whose
 * period also covers `date` (see api/src/routes/queues.ts) — so switching
 * between them only PUTs the destination queue and invalidates the source's
 * cache, rather than PUTting both.
 */
export function useTaskPlan(taskId: string, date: string) {
  const dayItems = useQueueItems(DAY_QUEUE_KEY, date)
  const weekItems = useQueueItems(WEEK_QUEUE_KEY, date)
  const setQueueItems = useSetQueueItems()
  const queryClient = useQueryClient()

  const dayIndex =
    dayItems.data?.findIndex((item) => item.taskId === taskId) ?? -1
  const weekIndex =
    weekItems.data?.findIndex((item) => item.taskId === taskId) ?? -1

  const plan: PlanValue | '' =
    dayIndex >= 0 ? 'day' : weekIndex >= 0 ? 'week' : ''

  const position: TaskPlanPosition | null =
    plan === 'day' && dayItems.data
      ? { index: dayIndex, total: dayItems.data.length }
      : plan === 'week' && weekItems.data
        ? { index: weekIndex, total: weekItems.data.length }
        : null

  const setPlan = (next: PlanValue | '') => {
    if (next === plan) return

    const onError = (error: unknown) => {
      console.error('Failed to update task queue', error)
    }

    if (next === '') {
      const key = queueKeyForPlan(plan)
      const items = plan === 'day' ? dayItems.data : weekItems.data
      setQueueItems.mutate(
        {
          key,
          date,
          taskIds: (items ?? [])
            .map((item) => item.taskId)
            .filter((id) => id !== taskId),
        },
        { onError },
      )
      return
    }

    const key = queueKeyForPlan(next)
    const items = next === 'day' ? dayItems.data : weekItems.data
    const previousKey = plan === '' ? null : queueKeyForPlan(plan)

    setQueueItems.mutate(
      {
        key,
        date,
        taskIds: [...(items ?? []).map((item) => item.taskId), taskId],
      },
      {
        onError,
        ...(previousKey == null
          ? {}
          : {
              onSuccess: () => {
                void queryClient.invalidateQueries({
                  queryKey: queueKeys.items(previousKey, date),
                })
              },
            }),
      },
    )
  }

  return {
    plan,
    position,
    setPlan,
    isLoading:
      dayItems.isLoading || weekItems.isLoading || setQueueItems.isPending,
  }
}
