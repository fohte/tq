import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { InferResponseType } from 'hono/client'

export type TaskPage = InferResponseType<
  (typeof api.api.tasks)[':taskId']['pages']['$get'],
  200
>[number]

const taskPageKeys = {
  all: (taskId: string) => ['tasks', 'detail', taskId, 'pages'] as const,
  detail: (taskId: string, pageId: string) =>
    ['tasks', 'detail', taskId, 'pages', pageId] as const,
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

export function useTaskPage(taskId: string, pageId: string) {
  return useQuery({
    queryKey: taskPageKeys.detail(taskId, pageId),
    queryFn: async () => {
      const res = await api.api.tasks[':taskId'].pages[':pageId'].$get({
        param: { taskId, pageId },
      })
      if (!res.ok) throw new Error('Failed to fetch task page')
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
      void queryClient.invalidateQueries({
        queryKey: taskPageKeys.all(taskId),
      })
      void queryClient.invalidateQueries({
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
      await queryClient.cancelQueries({
        queryKey: taskPageKeys.detail(taskId, pageId),
      })

      const previousPages = queryClient.getQueryData<TaskPage[]>(
        taskPageKeys.all(taskId),
      )
      const previousPage = queryClient.getQueryData<TaskPage>(
        taskPageKeys.detail(taskId, pageId),
      )

      const optimisticTimestamp = new Date().toISOString()

      if (previousPages) {
        queryClient.setQueryData<TaskPage[]>(
          taskPageKeys.all(taskId),
          previousPages.map((page) =>
            page.id === pageId
              ? { ...page, ...input, updatedAt: optimisticTimestamp }
              : page,
          ),
        )
      }

      if (previousPage) {
        queryClient.setQueryData<TaskPage>(
          taskPageKeys.detail(taskId, pageId),
          { ...previousPage, ...input, updatedAt: optimisticTimestamp },
        )
      }

      return { previousPages, previousPage }
    },
    onError: (_err, { pageId }, context) => {
      if (context?.previousPages) {
        queryClient.setQueryData(
          taskPageKeys.all(taskId),
          context.previousPages,
        )
      }
      if (context?.previousPage) {
        queryClient.setQueryData(
          taskPageKeys.detail(taskId, pageId),
          context.previousPage,
        )
      }
    },
    onSettled: (_data, _err, { pageId }) => {
      void queryClient.invalidateQueries({
        queryKey: taskPageKeys.all(taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskPageKeys.detail(taskId, pageId),
      })
      void queryClient.invalidateQueries({
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
      void queryClient.invalidateQueries({
        queryKey: taskPageKeys.all(taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: ['tasks', 'detail', taskId],
      })
    },
  })
}
