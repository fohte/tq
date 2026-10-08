import { useCallback, useEffect, useState } from 'react'

import { LinkExistingTaskMenuAppearance } from '#components/task/link-existing-task-menu-appearance'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import { useSelfAndDescendantIds, useUpdateTaskParent } from '#hooks/use-tasks'

export function LinkExistingTaskMenu({
  open,
  onOpenChange,
  parentId,
  parentNumber,
  parentTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId: string
  parentNumber: number
  parentTitle: string
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

  const excludedTaskIds = useSelfAndDescendantIds(parentId, open)
  const updateTaskParent = useUpdateTaskParent()

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
          {
            id: candidate.id,
            parentId,
            parent: { number: parentNumber, title: parentTitle },
          },
          { onSuccess: closeAndReset },
        )
      } else {
        setLinkDialogCandidate(candidate)
      }
    },
    [parentId, parentNumber, parentTitle, updateTaskParent, closeAndReset],
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
          {
            id: linkDialogCandidate.id,
            parentId,
            parent: { number: parentNumber, title: parentTitle },
          },
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
