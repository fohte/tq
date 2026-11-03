import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  assertTaskCompletionOk,
  createTaskCompletionRequest,
  notifyTaskCompletionFailed,
} from '#hooks/task-completion-failure'
import { projectKeys } from '#hooks/use-projects'
import type { Task, TaskDetail } from '#hooks/use-task-queries'
import { taskKeys } from '#hooks/use-task-queries'
import { api } from '#lib/api'

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      statusReason,
      duplicateOfTaskId,
    }: {
      id: string
      status: 'todo' | 'completed'
      taskNumber?: number
      statusReason?: 'completed' | 'not_planned' | 'duplicate'
      duplicateOfTaskId?: string
    }) => {
      const res = await api.api.tasks[':id'].status.$patch({
        param: { id },
        json: { status, statusReason, duplicateOfTaskId },
      })
      await assertTaskCompletionOk(res)
      return res.json()
    },
    onMutate: async ({ id, status, statusReason }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })
      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )

      // Mirrors the server: statusReason is only meaningful for 'completed',
      // cleared to null for every other status.
      const nextStatusReason =
        status === 'completed' ? (statusReason ?? 'completed') : null

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id
              ? { ...task, status, statusReason: nextStatusReason }
              : task,
          )
        },
      )

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          status,
          statusReason: nextStatusReason,
        })
      }

      return { previousLists, previousDetail }
    },
    onError: (
      error,
      { id, status, taskNumber, statusReason, duplicateOfTaskId },
      context,
    ) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(taskKeys.detail(id), context.previousDetail)
      }
      if (status === 'completed') {
        notifyTaskCompletionFailed(
          createTaskCompletionRequest('status', {
            id,
            taskNumber,
            statusReason,
            duplicateOfTaskId,
          }),
          error,
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      statusReason,
      duplicateOfTaskId,
    }: {
      id: string
      taskNumber?: number
      statusReason?: 'completed' | 'not_planned' | 'duplicate'
      duplicateOfTaskId?: string
    }) => {
      const res = await api.api.tasks[':id'].complete.$post({
        param: { id },
        json: { statusReason, duplicateOfTaskId },
      })
      await assertTaskCompletionOk(res)
      return res.json()
    },
    onMutate: async ({ id, statusReason }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists })
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) })

      const previousLists = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.lists,
      })
      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(id),
      )

      const now = new Date().toISOString()
      const nextStatusReason = statusReason ?? 'completed'

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: 'completed',
                  statusReason: nextStatusReason,
                  updatedAt: now,
                }
              : task,
          )
        },
      )

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(id), {
          ...previousDetail,
          status: 'completed',
          statusReason: nextStatusReason,
          updatedAt: now,
        })
      }

      return { previousLists, previousDetail }
    },
    onError: (
      error,
      { id, taskNumber, statusReason, duplicateOfTaskId },
      context,
    ) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(taskKeys.detail(id), context.previousDetail)
      }
      notifyTaskCompletionFailed(
        createTaskCompletionRequest('complete', {
          id,
          taskNumber,
          statusReason,
          duplicateOfTaskId,
        }),
        error,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
