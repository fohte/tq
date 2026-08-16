import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk } from '#lib/assert-response'

export type ActivityItem = InferResponseType<
  (typeof api.api.tasks)[':id']['activity']['$get'],
  200
>[number]

export const activityKeys = {
  all: (taskId: string) => ['tasks', taskId, 'activity'] as const,
}

export function useTaskActivity(taskId: string) {
  return useQuery({
    queryKey: activityKeys.all(taskId),
    queryFn: async () => {
      const res = await api.api.tasks[':id'].activity.$get({
        param: { id: taskId },
      })
      const result = assertOk(res)
      if (result.isErr()) throw result.error
      return result.value.json()
    },
  })
}
