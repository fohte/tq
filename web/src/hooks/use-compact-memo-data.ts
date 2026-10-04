import type { DayViewPresentationProps } from '#components/day-view/day-view'
import { useCompactRefreshErrorLogging } from '#hooks/use-compact-refresh-error-logging'
import { type MemoContext, useMemos, useUpdateMemo } from '#hooks/use-memos'

type CompactMemoProps = NonNullable<DayViewPresentationProps['compactMemo']>

interface UseCompactMemoDataOptions {
  enabled: boolean
  context: MemoContext
}

export function useCompactMemoData({
  enabled,
  context,
}: UseCompactMemoDataOptions): CompactMemoProps | undefined {
  const memosQuery = useMemos(context, enabled)
  const updateMemo = useUpdateMemo()

  useCompactRefreshErrorLogging(enabled, 'day view', {
    memos: memosQuery.error,
  })

  if (!enabled) return undefined

  return {
    context,
    memo: memosQuery.data,
    isLoading: memosQuery.isPending,
    loadError: memosQuery.data == null && memosQuery.isError,
    onSave: (input) => updateMemo.mutateAsync({ context, input }),
  }
}
