import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectKeys } from '#hooks/use-projects'
import type { Task, TaskDetail } from '#hooks/use-task-queries'
import { taskKeys } from '#hooks/use-task-queries'
import { api } from '#lib/api'
import { assertOk, assertOkOrThrow, unwrapOrThrow } from '#lib/assert-response'

export interface CreateTaskInput {
  title: string
  description?: string
  startDate?: string
  dueDate?: string
  estimatedMinutes?: number
  context?: 'work' | 'personal'
  labels?: string[]
  projectId?: string
  parentId?: string
}

// taskKeys.list() keys are ['tasks', 'list', filter], where filter carries
// an optional parentId — read it back without an unsafe cast.
function listKeyParentId(key: readonly unknown[]): string | undefined {
  const filter = key[2]
  if (typeof filter !== 'object' || filter === null) return undefined
  if (!('parentId' in filter)) return undefined
  const { parentId } = filter
  return typeof parentId === 'string' ? parentId : undefined
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await api.api.tasks.$post({
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })

      const now = new Date().toISOString()
      const optimisticTask: Task = {
        id: `optimistic-${String(Date.now())}`,
        number: -1,
        title: input.title,
        description: input.description ?? null,
        status: 'todo',
        context: input.context ?? 'personal',
        labels: input.labels ?? [],
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        parentId: input.parentId ?? null,
        parentNumber: null,
        projectId: input.projectId ?? null,
        recurrenceRuleId: null,
        githubLinks: [],
        createdAt: now,
        updatedAt: now,
        childCompletionCount: { completed: 0, total: 0 },
      }

      // Only insert into lists filtered by the same parentId — otherwise a
      // subtask briefly leaks into an unrelated task's cached subtask list
      // (or vice versa) until the next refetch. setQueriesData's updater
      // doesn't receive the query key, so match/update each entry by hand.
      for (const [key, data] of previousLists) {
        if (listKeyParentId(key) !== input.parentId) continue
        queryClient.setQueryData<Task[]>(
          key,
          data ? [optimisticTask, ...data] : [optimisticTask],
        )
      }

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
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
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
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })
      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id ? { ...task, status } : task,
          )
        },
      )

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          status,
        })
      }

      return { previousLists, previousDetail }
    },
    onError: (_err, { id }, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(taskKeys.detail(id), context.previousDetail)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  startDate?: string | null
  dueDate?: string | null
  estimatedMinutes?: number | null
  projectId?: string | null
  context?: 'work' | 'personal'
  labels?: string[]
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateTaskInput
    }) => {
      const res = await api.api.tasks[':id'].$patch({
        param: { id },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })

      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )
      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })

      const optimisticTimestamp = new Date().toISOString()

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          ...input,
          updatedAt: optimisticTimestamp,
        })
      }

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id
              ? { ...task, ...input, updatedAt: optimisticTimestamp }
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

export function useCompleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.tasks[':id'].complete.$post({ param: { id } })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })
      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )

      const now = new Date().toISOString()

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id
              ? { ...task, status: 'completed', updatedAt: now }
              : task,
          )
        },
      )

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          status: 'completed',
          updatedAt: now,
        })
      }

      return { previousLists, previousDetail }
    },
    onError: (_err, id, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(taskKeys.detail(id), context.previousDetail)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
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
      assertOkOrThrow(res)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.filter((task) => task.id !== id)
        },
      )

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
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
