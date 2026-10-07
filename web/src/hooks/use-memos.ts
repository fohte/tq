import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  MemoContext,
  MemoTransport,
  SaveMemoInput,
} from '#hooks/memo-save'
import { saveMemoWithConflictResolution } from '#hooks/memo-save'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type { Memo, MemoContext, SaveMemoInput } from '#hooks/memo-save'
export { appendMemoContent } from '#hooks/memo-save'

interface UpdateMemoVariables {
  context: MemoContext
  input: SaveMemoInput
}

const memoKeys = {
  detail: (context: MemoContext) => ['memos', context] as const,
}

const memoTransport: MemoTransport = {
  async read(context) {
    const response = await api.api.memos[':context'].$get({
      param: { context },
    })
    return unwrapOrThrow(assertOk(response)).json()
  },
  async update(context, input) {
    const response = await api.api.memos[':context'].$put({
      param: { context },
      json: input,
    })
    if (response.status === 409) return { status: 409 }
    return {
      status: 200,
      memo: await unwrapOrThrow(assertOk(response)).json(),
    }
  },
}

export function useMemos(context: MemoContext, isCompactLayout: boolean) {
  return useQuery({
    queryKey: memoKeys.detail(context),
    queryFn: () => memoTransport.read(context),
    enabled: isCompactLayout,
  })
}

export function useUpdateMemo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ context, input }: UpdateMemoVariables) =>
      unwrapOrThrow(
        await saveMemoWithConflictResolution(context, input, memoTransport),
      ),
    onSuccess: async (memo, { context }) => {
      await queryClient.cancelQueries({ queryKey: memoKeys.detail(context) })
      queryClient.setQueryData(memoKeys.detail(context), memo)
    },
    onError: (error, { context }) => {
      console.error(`Failed to save ${context} memo`, error)
    },
  })
}
