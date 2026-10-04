import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'
import { getCompactRefetchInterval } from '#lib/compact-layout'

export type Memo = InferResponseType<
  (typeof api.api.memos)[':context']['$get'],
  200
>
export type MemoContext = Memo['context']

export interface SaveMemoInput {
  content: string
  revision: number
  readCurrentDraft: () => string
}

type MemoUpdateResult = { status: 200; memo: Memo } | { status: 409 }

interface MemoTransport {
  read: (context: MemoContext) => Promise<Memo>
  update: (
    context: MemoContext,
    input: { content: string; revision: number },
  ) => Promise<MemoUpdateResult>
}

export const memoKeys = {
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

export function appendMemoContent(
  latestContent: string,
  pendingContent: string,
) {
  if (latestContent === '') return pendingContent
  if (pendingContent === '') return latestContent
  return `${latestContent}\n\n${pendingContent}`
}

export function saveMemoWithConflictResolution(
  context: MemoContext,
  input: SaveMemoInput,
  transport: MemoTransport,
): ResultAsync<Memo, Error> {
  return ResultAsync.fromPromise(
    transport.update(context, {
      content: input.content,
      revision: input.revision,
    }),
    toError,
  ).andThen((firstUpdate) => {
    if (firstUpdate.status === 200) return okAsync(firstUpdate.memo)

    return ResultAsync.fromPromise(transport.read(context), toError).andThen(
      (latestMemo) =>
        ResultAsync.fromPromise(
          transport.update(context, {
            content: appendMemoContent(
              latestMemo.content,
              input.readCurrentDraft(),
            ),
            revision: latestMemo.revision,
          }),
          toError,
        ).andThen((retry) =>
          retry.status === 409
            ? errAsync(new Error('Memo changed again while saving'))
            : okAsync(retry.memo),
        ),
    )
  })
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function useMemos(context: MemoContext, isCompactLayout: boolean) {
  return useQuery({
    queryKey: memoKeys.detail(context),
    queryFn: () => memoTransport.read(context),
    enabled: isCompactLayout,
    refetchInterval: getCompactRefetchInterval(isCompactLayout) ?? false,
  })
}

export function useUpdateMemo(context: MemoContext) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveMemoInput) =>
      unwrapOrThrow(
        await saveMemoWithConflictResolution(context, input, memoTransport),
      ),
    onSuccess: (memo) => {
      queryClient.setQueryData(memoKeys.detail(context), memo)
    },
  })
}
