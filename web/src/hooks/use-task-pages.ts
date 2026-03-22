import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { InferResponseType } from 'hono/client'

export type TaskPage = InferResponseType<
  (typeof api.api.tasks)[':taskId']['pages']['$get'],
  200
>[number]

const taskPageKeys = {
  all: (taskId: string) => ['tasks', 'detail', taskId, 'pages'] as const,
}

export function useTaskPages(taskId: string) {
  return useQuery({
    queryKey: taskPageKeys.all(taskId),
    queryFn: async () => {
      const res = await api.api.tasks[':taskId'].pages.$get({
        param: { taskId },
      })
      if (!res.ok) throw new Error('Failed to fetch task pages')
      return res.json()
    },
  })
}

export function useCreateTaskPage(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { title: string; content?: string }) => {
      const res = await api.api.tasks[':taskId'].pages.$post({
        param: { taskId },
        json: input,
      })
      if (!res.ok) throw new Error('Failed to create task page')
      return res.json()
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: taskPageKeys.all(taskId),
      })
      queryClient.invalidateQueries({
        queryKey: ['tasks', 'detail', taskId],
      })
    },
  })
}

export function useUpdateTaskPage(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pageId,
      input,
    }: {
      pageId: string
      input: { title?: string; content?: string }
    }) => {
      const res = await api.api.tasks[':taskId'].pages[':pageId'].$patch({
        param: { taskId, pageId },
        json: input,
      })
      if (!res.ok) throw new Error('Failed to update task page')
      return res.json()
    },
    onMutate: async ({ pageId, input }) => {
      await queryClient.cancelQueries({
        queryKey: taskPageKeys.all(taskId),
      })

      const previousPages = queryClient.getQueryData<TaskPage[]>(
        taskPageKeys.all(taskId),
      )

      if (previousPages) {
        queryClient.setQueryData<TaskPage[]>(
          taskPageKeys.all(taskId),
          previousPages.map((page) =>
            page.id === pageId
              ? { ...page, ...input, updatedAt: new Date().toISOString() }
              : page,
          ),
        )
      }

      return { previousPages }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPages) {
        queryClient.setQueryData(
          taskPageKeys.all(taskId),
          context.previousPages,
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: taskPageKeys.all(taskId),
      })
      queryClient.invalidateQueries({
        queryKey: ['tasks', 'detail', taskId],
      })
    },
  })
}

export function useDeleteTaskPage(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (pageId: string) => {
      const res = await api.api.tasks[':taskId'].pages[':pageId'].$delete({
        param: { taskId, pageId },
      })
      if (!res.ok) throw new Error('Failed to delete task page')
    },
    onMutate: async (pageId) => {
      await queryClient.cancelQueries({
        queryKey: taskPageKeys.all(taskId),
      })

      const previousPages = queryClient.getQueryData<TaskPage[]>(
        taskPageKeys.all(taskId),
      )

      if (previousPages) {
        queryClient.setQueryData<TaskPage[]>(
          taskPageKeys.all(taskId),
          previousPages.filter((page) => page.id !== pageId),
        )
      }

      return { previousPages }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPages) {
        queryClient.setQueryData(
          taskPageKeys.all(taskId),
          context.previousPages,
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: taskPageKeys.all(taskId),
      })
      queryClient.invalidateQueries({
        queryKey: ['tasks', 'detail', taskId],
      })
    },
  })
}
