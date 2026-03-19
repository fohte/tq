import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { InferResponseType } from 'hono/client'

type Task = InferResponseType<typeof api.api.tasks.$get>[number]

const taskKeys = {
  all: ['tasks'] as const,
  list: (filter?: { status?: string }) =>
    [...taskKeys.all, 'list', filter] as const,
}

export type { Task }

type TaskStatus = 'todo' | 'in_progress' | 'completed'

export function useTaskList(filter?: { status?: TaskStatus }) {
  return useQuery({
    queryKey: taskKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: filter ?? {},
      })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      return res.json()
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      title: string
      context?: 'work' | 'personal' | 'dev'
    }) => {
      const res = await api.api.tasks.$post({
        json: input,
      })
      if (!res.ok) throw new Error('Failed to create task')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: 'todo' | 'in_progress' | 'completed'
    }) => {
      const res = await api.api.tasks[':id'].status.$patch({
        param: { id },
        json: { status },
      })
      if (!res.ok) throw new Error('Failed to update task status')
      return res.json()
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.all,
      })

      queryClient.setQueriesData<Task[]>({ queryKey: taskKeys.all }, (old) => {
        if (!old) return old
        return old.map((task) => (task.id === id ? { ...task, status } : task))
      })

      return { previousLists }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.tasks[':id'].$delete({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to delete task')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.all,
      })

      queryClient.setQueriesData<Task[]>({ queryKey: taskKeys.all }, (old) => {
        if (!old) return old
        return old.filter((task) => task.id !== id)
      })

      return { previousLists }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
