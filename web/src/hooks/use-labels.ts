import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { taskKeys } from '#hooks/use-task-queries'
import { api } from '#lib/api'
import {
  assertOk,
  assertOkOrThrow,
  assertOkWithMessage,
  unwrapOrThrow,
} from '#lib/assert-response'

export type Label = InferResponseType<typeof api.api.labels.$get, 200>[number]

export interface LabelFilter {
  context?: 'work' | 'personal'
}

export const labelKeys = {
  all: ['labels'] as const,
  list: (filter?: LabelFilter) => [...labelKeys.all, filter] as const,
}

export function useLabels(filter?: LabelFilter) {
  return useQuery({
    queryKey: labelKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.labels.$get({
        query: filter?.context ? { context: filter.context } : {},
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export interface UpdateLabelInput {
  name?: string
  context?: 'work' | 'personal'
}

// Task list/detail responses embed each label's current name, so a rename or
// delete must invalidate taskKeys.all too, not just labelKeys.all.
export function useUpdateLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateLabelInput
    }) => {
      const res = await api.api.labels[':id'].$patch({
        param: { id },
        json: input,
      })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    // These two refetches settle independently, so a renamed tag can briefly
    // drop out of the sidebar's TAGS list until the tasks refetch also lands.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: labelKeys.all })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.labels[':id'].$delete({ param: { id } })
      assertOkOrThrow(res)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: labelKeys.all })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
