import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { RecurrenceType } from '#components/schedule/create-schedule-modal'
import type { TaskPriority } from '#hooks/use-priority-settings'
import { projectKeys } from '#hooks/use-projects'
import type { Task, TaskDetail } from '#hooks/use-task-queries'
import { taskKeys } from '#hooks/use-task-queries'
import { api } from '#lib/api'
import { assertOk, assertOkOrThrow, unwrapOrThrow } from '#lib/assert-response'
import { queueKeys } from '#lib/query-keys'
import { removeRecentSearchItem } from '#lib/recent-search-items'

export interface CreateTaskInput {
  title: string
  description?: string
  startDate?: string
  dueDate?: string
  context?: 'work' | 'personal'
  priority?: TaskPriority
  labels?: string[]
  projectId?: string
  parentId?: string
  recurrenceRule?: {
    type: 'daily' | 'weekly' | 'monthly'
    interval: number
    daysOfWeek?: number[]
  }
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
        status: 'todo',
        statusReason: null,
        duplicateOfNumber: null,
        context: input.context ?? 'personal',
        priority: input.priority ?? null,
        labels: input.labels ?? [],
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        remindAt: null,
        parentId: input.parentId ?? null,
        parentNumber: null,
        projectId: input.projectId ?? null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        templateId: null,
        occurrenceDate: null,
        githubLinks: [],
        createdAt: now,
        updatedAt: now,
        childCompletionCount: { completed: 0, total: 0 },
        checklistCompletionCount: { completed: 0, total: 0 },
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        hasUnresolvedWait: false,
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

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  startDate?: string | null
  dueDate?: string | null
  remindAt?: string | null
  projectId?: string | null
  context?: 'work' | 'personal'
  priority?: TaskPriority
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
      const listInput = omitTaskDescription(input)

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
              ? { ...task, ...listInput, updatedAt: optimisticTimestamp }
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
    onSettled: (_data, _err, { id, input }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      if (input.dueDate !== undefined) {
        void queryClient.invalidateQueries({ queryKey: queueKeys.all })
      }
    },
  })
}

function omitTaskDescription(
  input: UpdateTaskInput,
): Omit<UpdateTaskInput, 'description'> {
  const listInput = { ...input }
  delete listInput.description
  return listInput
}

export function useUpdateTaskRecurrenceRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      recurrenceRule,
    }: {
      id: string
      // Not #lib/recurrence's RecurrenceRule: the PATCH schema only accepts
      // daysOfWeek/dayOfMonth as absent-or-present, never explicit null,
      // while RecurrenceRule allows null to also represent the read side
      // (TaskDetail.recurrenceRule, where the DB column can be null).
      recurrenceRule: {
        type: RecurrenceType
        interval: number
        daysOfWeek?: number[]
        dayOfMonth?: number
      } | null
    }) => {
      const res = await api.api.tasks[':id'].$patch({
        param: { id },
        json: { recurrenceRule },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, recurrenceRule }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })

      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )

      // The server assigns the real rule id; a placeholder stands in until
      // onSettled's invalidation refetches the real one.
      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          recurrenceRule:
            recurrenceRule == null
              ? null
              : {
                  id: previousDetail.recurrenceRule?.id ?? 'optimistic',
                  type: recurrenceRule.type,
                  interval: recurrenceRule.interval,
                  daysOfWeek: recurrenceRule.daysOfWeek ?? null,
                  dayOfMonth: recurrenceRule.dayOfMonth ?? null,
                },
          updatedAt: new Date().toISOString(),
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
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export {
  useCompleteTask,
  useUpdateTaskStatus,
} from '#hooks/use-task-completion-mutations'
export {
  useUpdateTaskBlockedBy,
  useUpdateTaskParent,
} from '#hooks/use-task-relation-mutations'

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.tasks[':id'].$delete({
        param: { id },
      })
      assertOkOrThrow(res)
    },
    onSuccess: (_data, id) => {
      removeRecentSearchItem('task', id)
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
