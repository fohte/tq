import { useCallback, useEffect, useMemo, useState } from 'react'

import { LinkExistingTaskDialog } from '#components/task/link-existing-task-dialog'
import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { type SearchResult } from '#hooks/use-search'
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

  useEffect(() => {
    if (open) {
      setLinkDialogCandidate(null)
    }
  }, [open])

  const { categorized } = useTaskList(undefined, { enabled: open })
  const updateTaskParent = useUpdateTaskParent()

  const excludedTaskIds = useMemo(
    () => new Set([parentId, ...getDescendantIds(categorized.all, parentId)]),
    [parentId, categorized.all],
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
    <>
      <TaskSearchCandidateDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Link existing task"
        excludedTaskIds={excludedTaskIds}
        onSelectCandidate={selectCandidate}
      />

      <LinkExistingTaskDialog
        candidate={linkDialogCandidate}
        parentTaskNumber={parentNumber}
        open={linkDialogCandidate != null}
        onOpenChange={(nextOpen) => {
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
    </>
  )
}
