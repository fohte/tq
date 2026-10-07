import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import {
  assertOk,
  assertOkOrThrow,
  assertOkWithMessage,
  unwrapOrThrow,
} from '#lib/assert-response'
import { taskChecklistKeys, taskKeys } from '#lib/query-keys'

type TaskChecklistResponse = InferResponseType<
  (typeof api.api.tasks)[':taskId']['checklists']['$get'],
  200
>[number]

export type TaskChecklistItem = NonNullable<
  TaskChecklistResponse['items']
>[number]

export type TaskChecklist = Omit<TaskChecklistResponse, 'items'> & {
  items: TaskChecklistItem[]
}

export type CreateTaskChecklistInput = InferRequestType<
  (typeof api.api.tasks)[':taskId']['checklists']['$post']
>['json']

export type UpdateTaskChecklistInput = InferRequestType<
  (typeof api.api.checklists)[':checklistId']['$patch']
>['json']

export type CreateTaskChecklistItemInput = InferRequestType<
  (typeof api.api.checklists)[':checklistId']['items']['$post']
>['json']

export type UpdateTaskChecklistItemInput = InferRequestType<
  (typeof api.api)['checklist-items'][':itemId']['$patch']
>['json']

export type MoveTaskChecklistItemInput = InferRequestType<
  (typeof api.api)['checklist-items'][':itemId']['move']['$patch']
>['json']

function invalidateTaskChecklists(
  taskId: string,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: taskChecklistKeys.all(taskId),
  })
}

export function useTaskChecklists(taskId: string) {
  return useQuery({
    queryKey: taskChecklistKeys.all(taskId),
    queryFn: async () => {
      const res = await api.api.tasks[':taskId'].checklists.$get({
        param: { taskId },
      })
      return unwrapOrThrow(assertOk(res))
        .json()
        .then((checklists) =>
          checklists.map((checklist) => ({
            ...checklist,
            items: checklist.items ?? [],
          })),
        )
    },
  })
}

export function useCreateTaskChecklist(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTaskChecklistInput) => {
      const res = await api.api.tasks[':taskId'].checklists.$post({
        param: { taskId },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useUpdateTaskChecklist(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      checklistId,
      input,
    }: {
      checklistId: string
      input: UpdateTaskChecklistInput
    }) => {
      const res = await api.api.checklists[':checklistId'].$patch({
        param: { checklistId },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useReorderTaskChecklists(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (checklistIds: string[]) => {
      for (const [sortOrder, checklistId] of checklistIds.entries()) {
        const res = await api.api.checklists[':checklistId'].$patch({
          param: { checklistId },
          json: { sortOrder },
        })
        assertOkOrThrow(res)
      }
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useDeleteTaskChecklist(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (checklistId: string) => {
      const res = await api.api.checklists[':checklistId'].$delete({
        param: { checklistId },
      })
      assertOkOrThrow(res)
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useCreateTaskChecklistItem(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      checklistId,
      input,
    }: {
      checklistId: string
      input: CreateTaskChecklistItemInput
    }) => {
      const res = await api.api.checklists[':checklistId'].items.$post({
        param: { checklistId },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useUpdateTaskChecklistItem(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      input,
    }: {
      itemId: string
      input: UpdateTaskChecklistItemInput
    }) => {
      const res = await api.api['checklist-items'][':itemId'].$patch({
        param: { itemId },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useLinkTaskChecklistItemToGithub() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, url }: { itemId: string; url: string }) => {
      const res = await api.api['checklist-items'][':itemId'].$patch({
        param: { itemId },
        json: { github: url },
      })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function usePromoteTaskChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await api.api['checklist-items'][':itemId'].promote.$post({
        param: { itemId },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTaskChecklistItem(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await api.api['checklist-items'][':itemId'].$delete({
        param: { itemId },
      })
      assertOkOrThrow(res)
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useMoveTaskChecklistItem(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      input,
    }: {
      itemId: string
      input: MoveTaskChecklistItemInput
    }) => {
      const res = await api.api['checklist-items'][':itemId'].move.$patch({
        param: { itemId },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}

export function useSetTaskChecklistItemChecked(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      checked,
    }: {
      itemId: string
      checked: boolean
    }) => {
      const endpoint = api.api['checklist-items'][':itemId']
      const res = checked
        ? await endpoint.check.$post({ param: { itemId } })
        : await endpoint.uncheck.$post({ param: { itemId } })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      invalidateTaskChecklists(taskId, queryClient)
    },
  })
}
