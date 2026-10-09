import { useCallback } from 'react'

import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { type SearchResult } from '#hooks/use-search'
import { useSelfAndDescendantIds, useUpdateTaskParent } from '#hooks/use-tasks'

export function MoveUnderTaskMenu({
  open,
  onOpenChange,
  taskId,
  taskNumber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskNumber: number
}) {
  const excludedTaskIds = useSelfAndDescendantIds(taskId, open)
  const updateTaskParent = useUpdateTaskParent()

  const selectCandidate = useCallback(
    (candidate: SearchResult) => {
      updateTaskParent.mutate(
        {
          id: taskId,
          parentId: candidate.id,
          parent: { number: candidate.number, title: candidate.title },
        },
        {
          onSuccess: () => {
            onOpenChange(false)
          },
        },
      )
    },
    [taskId, updateTaskParent, onOpenChange],
  )

  return (
    <TaskSearchCandidateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Move #${String(taskNumber)} under`}
      excludedTaskIds={excludedTaskIds}
      onSelectCandidate={selectCandidate}
    />
  )
}
