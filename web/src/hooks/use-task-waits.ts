import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectKeys } from '#hooks/use-projects'
import type { TaskWait } from '#hooks/use-task-queries'
import { taskKeys } from '#hooks/use-task-queries'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

async function invalidateTaskWaitQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) }),
    queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  ])
}

export function useCreateTaskWait() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      taskId,
      body,
      followUpDate,
    }: {
      taskId: string
      body: string
      followUpDate: string
    }) => {
      const res = await api.api.tasks[':taskId'].waits.$post({
        param: { taskId },
        json: { body, followUpDate },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: (_data, _error, { taskId }) =>
      invalidateTaskWaitQueries(queryClient, taskId),
  })
}

export function useUpdateTaskWait(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      waitId,
      ...input
    }: {
      waitId: string
      body?: string
      followUpDate?: string
    }) => {
      const res = await api.api.tasks[':taskId'].waits[':waitId'].$patch({
        param: { taskId, waitId },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => invalidateTaskWaitQueries(queryClient, taskId),
  })
}

export function useResolveTaskWait(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (waitId: string): Promise<TaskWait> => {
      const res = await api.api.tasks[':taskId'].waits[':waitId'].resolve.$post(
        { param: { taskId, waitId } },
      )
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => invalidateTaskWaitQueries(queryClient, taskId),
  })
}

export function useDeleteTaskWait(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (waitId: string) => {
      const res = await api.api.tasks[':taskId'].waits[':waitId'].$delete({
        param: { taskId, waitId },
      })
      return unwrapOrThrow(assertOk(res))
    },
    onSettled: () => invalidateTaskWaitQueries(queryClient, taskId),
  })
}
