import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'

import { MemoWindow } from '#components/memo/memo-window'
import { useCurrentContext } from '#hooks/use-current-context'
import { type SaveMemoInput, useMemos, useUpdateMemo } from '#hooks/use-memos'

interface MemoSearch {
  layout?: 'compact'
}

function validateSearch(search: Record<string, unknown>): MemoSearch {
  return search['layout'] === 'compact' ? { layout: 'compact' } : {}
}

export const Route = createFileRoute('/memo')({
  validateSearch,
  component: MemoRoute,
})

function MemoRoute() {
  const context = useCurrentContext()
  const memoQuery = useMemos(context, true)
  const updateMemo = useUpdateMemo()
  const saveMemo = useCallback(
    (input: SaveMemoInput) => updateMemo.mutateAsync({ context, input }),
    [context, updateMemo],
  )

  return (
    <MemoWindow
      context={context}
      memo={memoQuery.data}
      isLoading={memoQuery.isPending}
      loadError={memoQuery.data == null && memoQuery.isError}
      onSave={saveMemo}
    />
  )
}
