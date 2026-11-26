import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'
import type { SuccessStatusCode } from 'hono/utils/http-status'
import { err } from 'neverthrow'

import { api } from '#lib/api'
import {
  assertOk,
  assertOkOrThrow,
  assertOkWithMessage,
  unwrapOrThrow,
} from '#lib/assert-response'
import { projectKeys } from '#lib/query-keys'

const projectFieldsApi = api.api.projects[':projectId'].fields

export type ProjectField = InferResponseType<
  typeof projectFieldsApi.$get,
  200
>[number]
export type CreateProjectFieldInput = InferRequestType<
  typeof projectFieldsApi.$post
>['json']

function conflictMessage(res: { status: number }, entity: 'field' | 'option') {
  if (res.status !== 409) return null
  return entity === 'field'
    ? 'このプロジェクトには同じ名前のフィールドがあります'
    : 'このフィールドには同じ名前の選択肢があります'
}

async function assertProjectFieldResponse<
  R extends {
    status: number
    ok: boolean
    json: () => Promise<unknown>
  },
>(
  res: R,
  entity: 'field' | 'option',
): Promise<Extract<R, { status: SuccessStatusCode }>> {
  const conflict = conflictMessage(res, entity)
  if (conflict != null) {
    return unwrapOrThrow(err(new Error(conflict)))
  }
  return unwrapOrThrow(await assertOkWithMessage(res))
}

export function useProjectFields(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: projectKeys.fields(projectId),
    enabled,
    queryFn: async () => {
      const res = await projectFieldsApi.$get({ param: { projectId } })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

function useInvalidateProjectFields(projectId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: projectKeys.fields(projectId) })
}

export function useCreateProjectField(projectId: string) {
  const invalidate = useInvalidateProjectFields(projectId)
  return useMutation({
    mutationFn: async (input: CreateProjectFieldInput) => {
      const res = await projectFieldsApi.$post({
        param: { projectId },
        json: input,
      })
      return (await assertProjectFieldResponse(res, 'field')).json()
    },
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateProjectField(projectId: string) {
  const invalidate = useInvalidateProjectFields(projectId)
  return useMutation({
    mutationFn: async ({
      fieldId,
      name,
    }: {
      fieldId: string
      name: string
    }) => {
      const res = await projectFieldsApi[':fieldId'].$patch({
        param: { projectId, fieldId },
        json: { name },
      })
      return (await assertProjectFieldResponse(res, 'field')).json()
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteProjectField(projectId: string) {
  const invalidate = useInvalidateProjectFields(projectId)
  return useMutation({
    mutationFn: async (fieldId: string) => {
      const res = await projectFieldsApi[':fieldId'].$delete({
        param: { projectId, fieldId },
      })
      assertOkOrThrow(res)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useCreateProjectFieldOption(projectId: string) {
  const invalidate = useInvalidateProjectFields(projectId)
  return useMutation({
    mutationFn: async ({
      fieldId,
      name,
    }: {
      fieldId: string
      name: string
    }) => {
      const res = await projectFieldsApi[':fieldId'].options.$post({
        param: { projectId, fieldId },
        json: { name },
      })
      return (await assertProjectFieldResponse(res, 'option')).json()
    },
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateProjectFieldOption(projectId: string) {
  const invalidate = useInvalidateProjectFields(projectId)
  return useMutation({
    mutationFn: async ({
      fieldId,
      optionId,
      name,
    }: {
      fieldId: string
      optionId: string
      name: string
    }) => {
      const res = await projectFieldsApi[':fieldId'].options[
        ':optionId'
      ].$patch({
        param: { projectId, fieldId, optionId },
        json: { name },
      })
      return (await assertProjectFieldResponse(res, 'option')).json()
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteProjectFieldOption(projectId: string) {
  const invalidate = useInvalidateProjectFields(projectId)
  return useMutation({
    mutationFn: async ({
      fieldId,
      optionId,
    }: {
      fieldId: string
      optionId: string
    }) => {
      const res = await projectFieldsApi[':fieldId'].options[
        ':optionId'
      ].$delete({
        param: { projectId, fieldId, optionId },
      })
      assertOkOrThrow(res)
    },
    onSuccess: () => void invalidate(),
  })
}
