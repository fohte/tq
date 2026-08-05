import { useCallback, useMemo } from 'react'

import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { type SearchResult } from '#hooks/use-search'
import { useTaskList, useUpdateTaskParent } from '#hooks/use-tasks'
import { getDescendantIds } from '#lib/task-tree'

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
  const { categorized } = useTaskList(undefined, { enabled: open })
  const updateTaskParent = useUpdateTaskParent()

  // A task can't become its own ancestor, so both itself and every current
  // descendant are excluded from the candidate list.
  const excludedTaskIds = useMemo(
    () => new Set([taskId, ...getDescendantIds(categorized.all, taskId)]),
    [taskId, categorized.all],
  )

  const selectCandidate = useCallback(
    (candidate: SearchResult) => {
      updateTaskParent.mutate(
        { id: taskId, parentId: candidate.id },
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
