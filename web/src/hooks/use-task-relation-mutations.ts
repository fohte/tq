import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectKeys } from '#hooks/use-projects'
import type {
  LinkedTaskSummary,
  Task,
  TaskDetail,
} from '#hooks/use-task-queries'
import { taskKeys } from '#hooks/use-task-queries'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export function useUpdateTaskParent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      parentId,
    }: {
      id: string
      parentId: string | null
    }) => {
      const res = await api.api.tasks[':id'].parent.$patch({
        param: { id },
        json: { parentId },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, parentId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })

      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )
      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          parentId,
          updatedAt: new Date().toISOString(),
        })
      }

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id
              ? { ...task, parentId, updatedAt: new Date().toISOString() }
              : task,
          )
        },
      )

      return { previousDetail, previousLists }
    },
    onError: (_err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(taskKeys.detail(id), context.previousDetail)
      }
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

// Callers pass full LinkedTaskSummary objects (not just ids) since the PATCH
// response never echoes blockedBy/blocking back for the optimistic update.
export function useUpdateTaskBlockedBy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      blockedBy,
      githubBlockerUrls,
    }: {
      id: string
      blockedBy: LinkedTaskSummary[]
      githubBlockerUrls: string[]
    }) => {
      const res = await api.api.tasks[':id'].$patch({
        param: { id },
        json: {
          blockedBy: [
            ...blockedBy.map((task) => task.id),
            ...githubBlockerUrls,
          ],
        },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, blockedBy }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })

      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          blockedBy,
        })
      }

      return { previousDetail }
    },
    onError: (_err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(taskKeys.detail(id), context.previousDetail)
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
    },
  })
}
