import { useCallback, useEffect, useMemo, useState } from 'react'

import { LinkExistingTaskMenuAppearance } from '#components/task/link-existing-task-menu-appearance'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import { useTaskList, useUpdateTaskParent } from '#hooks/use-tasks'
import { getDescendantIds } from '#lib/task-tree'

export function LinkExistingTaskMenu({
  open,
  onOpenChange,
  parentId,
  parentNumber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId: string
  parentNumber: number
}) {
  const [linkDialogCandidate, setLinkDialogCandidate] =
    useState<SearchResult | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) {
      setLinkDialogCandidate(null)
      setQuery('')
    }
  }, [open])

  const { categorized } = useTaskList(undefined, { enabled: open })
  const updateTaskParent = useUpdateTaskParent()

  const excludedTaskIds = useMemo(
    () => new Set([parentId, ...getDescendantIds(categorized.all, parentId)]),
    [parentId, categorized.all],
  )

  const { data: searchResults, isFetching } = useSearchTasks(query)
  const candidates = (searchResults ?? []).filter(
    (t) => !excludedTaskIds.has(t.id),
  )

  const closeAndReset = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const selectCandidate = useCallback(
    (candidate: SearchResult) => {
      if (candidate.parentId == null) {
        updateTaskParent.mutate(
          { id: candidate.id, parentId },
          { onSuccess: closeAndReset },
        )
      } else {
        setLinkDialogCandidate(candidate)
      }
    },
    [parentId, updateTaskParent, closeAndReset],
  )

  return (
    <LinkExistingTaskMenuAppearance
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      candidates={candidates}
      isFetching={isFetching}
      onSelectCandidate={selectCandidate}
      confirmCandidate={linkDialogCandidate}
      parentTaskNumber={parentNumber}
      onConfirmDialogOpenChange={(nextOpen) => {
        if (!nextOpen) setLinkDialogCandidate(null)
      }}
      onConfirm={() => {
        if (linkDialogCandidate == null) return
        updateTaskParent.mutate(
          { id: linkDialogCandidate.id, parentId },
          {
            onSuccess: () => {
              setLinkDialogCandidate(null)
              closeAndReset()
            },
          },
        )
      }}
    />
  )
}
