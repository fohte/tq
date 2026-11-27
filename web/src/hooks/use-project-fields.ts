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
import { projectKeys, taskKeys } from '#lib/query-keys'

type ProjectFieldsApi = (typeof api.api.projects)[':projectId']['fields']

// テストで差し替えた API endpoint を使えるよう、呼び出し時に取得する
function getProjectFieldsApi() {
  return api.api.projects[':projectId'].fields
}

export type ProjectField = InferResponseType<
  ProjectFieldsApi['$get'],
  200
>[number]
export type CreateProjectFieldInput = InferRequestType<
  ProjectFieldsApi['$post']
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
      const res = await getProjectFieldsApi().$get({ param: { projectId } })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

function useInvalidateProjectFields(projectId: string) {
  const queryClient = useQueryClient()
  return () => {
    // タスク応答にもフィールド名を含むため、定義変更後はタスクも再取得する
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: projectKeys.fields(projectId),
      }),
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    ])
  }
}

export function useCreateProjectField(projectId: string) {
  const invalidate = useInvalidateProjectFields(projectId)
  return useMutation({
    mutationFn: async (input: CreateProjectFieldInput) => {
      const res = await getProjectFieldsApi().$post({
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
      const res = await getProjectFieldsApi()[':fieldId'].$patch({
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
      const res = await getProjectFieldsApi()[':fieldId'].$delete({
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
      const res = await getProjectFieldsApi()[':fieldId'].options.$post({
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
      const res = await getProjectFieldsApi()[':fieldId'].options[
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
      const res = await getProjectFieldsApi()[':fieldId'].options[
        ':optionId'
      ].$delete({
        param: { projectId, fieldId, optionId },
      })
      assertOkOrThrow(res)
    },
    onSuccess: () => void invalidate(),
  })
}
