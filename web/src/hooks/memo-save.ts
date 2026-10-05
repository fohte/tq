import type { InferResponseType } from 'hono/client'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { api } from '#lib/api'

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

export interface MemoTransport {
  read: (context: MemoContext) => Promise<Memo>
  update: (
    context: MemoContext,
    input: { content: string; revision: number },
  ) => Promise<MemoUpdateResult>
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
