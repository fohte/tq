import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import {
  assertOk,
  assertOkOrThrow,
  assertOkWithMessage,
  unwrapOrThrow,
} from '#lib/assert-response'

export type DescriptionTemplate = InferResponseType<
  (typeof api.api)['description-templates']['$get'],
  200
>[number]

export type CreateDescriptionTemplateInput = InferRequestType<
  (typeof api.api)['description-templates']['$post']
>['json']

export type UpdateDescriptionTemplateInput = InferRequestType<
  (typeof api.api)['description-templates'][':name']['$patch']
>['json']

const descriptionTemplateKeys = {
  all: ['description-templates'] as const,
  lists: ['description-templates', 'list'] as const,
  list: () => descriptionTemplateKeys.lists,
}

export function useDescriptionTemplates({
  enabled = true,
}: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: descriptionTemplateKeys.list(),
    enabled,
    queryFn: async () => {
      const res = await api.api['description-templates'].$get()
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useCreateDescriptionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateDescriptionTemplateInput) => {
      const res = await api.api['description-templates'].$post({ json: input })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: descriptionTemplateKeys.all,
      })
    },
  })
}

export function useUpdateDescriptionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      input,
    }: {
      name: string
      input: UpdateDescriptionTemplateInput
    }) => {
      const res = await api.api['description-templates'][':name'].$patch({
        param: { name: encodeURIComponent(name) },
        json: input,
      })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: descriptionTemplateKeys.all,
      })
    },
  })
}

export function useDeleteDescriptionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.api['description-templates'][':name'].$delete({
        param: { name: encodeURIComponent(name) },
      })
      assertOkOrThrow(res)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: descriptionTemplateKeys.all,
      })
    },
  })
}
