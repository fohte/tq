import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertOk } from '@web/lib/assert-response'
import type { InferResponseType } from 'hono/client'
import { useMemo } from 'react'

type Task = InferResponseType<typeof api.api.tasks.$get>[number]

type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

type TreeNode = InferResponseType<typeof api.api.tasks.tree.$get, 200>[number]

const taskKeys = {
  all: ['tasks'] as const,
  lists: ['tasks', 'list'] as const,
  list: (filter?: { status?: string; context?: string }) =>
    [...taskKeys.lists, filter] as const,
  tree: ['tasks', 'tree'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
}

export type { Task, TaskDetail, TreeNode }

type TaskStatus = 'todo' | 'in_progress' | 'completed'

function isBacklog(t: Task): boolean {
  return t.status === 'todo' && t.dueDate == null && t.startDate == null
}

export interface CategorizedTasks {
  /** All tasks from the API */
  all: Task[]
  /** Non-completed, non-backlog tasks (the "today" queue) */
  today: Task[]
  /** Tasks with no date and status=todo */
  backlog: Task[]
  /** Non-backlog tasks (for header stats: includes completed) */
  nonBacklog: Task[]
}

type TaskContext = 'work' | 'personal' | 'dev'

export function useTaskList(filter?: {
  status?: TaskStatus
  context?: TaskContext
}) {
  const query = useQuery({
    queryKey: taskKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: filter ?? {},
      })
      assertOk(res)
      return res.json()
    },
  })

  const categorized = useMemo((): CategorizedTasks => {
    const all = query.data ?? []
    const backlog = all.filter(isBacklog)
    const backlogIds = new Set(backlog.map((t) => t.id))
    const today = all.filter(
      (t) => t.status !== 'completed' && !backlogIds.has(t.id),
    )
    const nonBacklog = all.filter((t) => !backlogIds.has(t.id))
    return { all, today, backlog, nonBacklog }
  }, [query.data])

  return { ...query, categorized }
}

export interface CreateTaskInput {
  title: string
  description?: string
  startDate?: string
  dueDate?: string
  estimatedMinutes?: number
  context?: 'work' | 'personal' | 'dev'
  labels?: string[]
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await api.api.tasks.$post({
        json: input,
      })
      if (!res.ok) throw new Error('Failed to create task')
      return res.json()
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })

      const now = new Date().toISOString()
      const optimisticTask: Task = {
        id: `optimistic-${String(Date.now())}`,
        title: input.title,
        description: input.description ?? null,
        status: 'todo',
        context: input.context ?? 'personal',
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        parentId: null,
        projectId: null,
        sortOrder: 0,
        recurrenceRuleId: null,
        recurrenceRule: null,
        createdAt: now,
        updatedAt: now,
        activeTimeBlockStartTime: null,
      }

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return [optimisticTask]
          return [optimisticTask, ...old]
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
    },
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const res = await api.api.tasks[':id'].$get({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to fetch task')
      return res.json()
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
  context?: 'work' | 'personal' | 'dev'
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
      if (!res.ok) throw new Error('Failed to update task')
      return res.json()
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
    },
  })
}

export function useTaskTree(options: { enabled: boolean }) {
  return useQuery({
    queryKey: taskKeys.tree,
    queryFn: async () => {
      const res = await api.api.tasks.tree.$get({ query: {} })
      assertOk(res)
      return res.json()
    },
    enabled: options.enabled,
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
      if (!res.ok) throw new Error('Failed to update task parent')
      return res.json()
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
    },
  })
}

function useTaskActionMutation(
  apiCall: (id: string) => Promise<Response>,
  optimisticStatus: TaskStatus,
  errorMsg: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiCall(id)
      if (!res.ok) throw new Error(errorMsg)
      return res.json() as Promise<unknown>
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
      const activeTimeBlockStartTime =
        optimisticStatus === 'in_progress' ? now : null

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: optimisticStatus,
                  updatedAt: now,
                  activeTimeBlockStartTime,
                }
              : task,
          )
        },
      )

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          status: optimisticStatus,
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
    },
  })
}

export function useStartTask() {
  return useTaskActionMutation(
    (id) => api.api.tasks[':id'].start.$post({ param: { id } }),
    'in_progress',
    'Failed to start task',
  )
}

export function useStopTask() {
  return useTaskActionMutation(
    (id) => api.api.tasks[':id'].stop.$post({ param: { id } }),
    'todo',
    'Failed to stop task',
  )
}

export function useCompleteTask() {
  return useTaskActionMutation(
    (id) => api.api.tasks[':id'].complete.$post({ param: { id } }),
    'completed',
    'Failed to complete task',
  )
}

export function useTaskActions(id: string, status: TaskStatus) {
  const startTask = useStartTask()
  const stopTask = useStopTask()
  const completeTask = useCompleteTask()
  const updateStatus = useUpdateTaskStatus()

  const handleStatusAction = () => {
    if (status === 'todo') {
      startTask.mutate(id)
    } else if (status === 'in_progress') {
      stopTask.mutate(id)
    } else {
      updateStatus.mutate({ id, status: 'todo' })
    }
  }

  const handleComplete = () => {
    completeTask.mutate(id)
  }

  return { handleStatusAction, handleComplete }
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
    },
  })
}
