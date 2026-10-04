import { LinkExistingTaskDialog } from '#components/task/link-existing-task-dialog'
import { TaskSearchCandidateDialogAppearance } from '#components/task/task-search-candidate-dialog'
import type { SearchResult } from '#hooks/use-search'

export function LinkExistingTaskMenuAppearance({
  open,
  onOpenChange,
  query,
  onQueryChange,
  candidates,
  isFetching,
  onSelectCandidate,
  confirmCandidate,
  parentTaskNumber,
  onConfirmDialogOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  candidates: SearchResult[]
  isFetching: boolean
  onSelectCandidate: (candidate: SearchResult) => void
  confirmCandidate: SearchResult | null
  parentTaskNumber: number
  onConfirmDialogOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <>
      <TaskSearchCandidateDialogAppearance
        open={open}
        onOpenChange={onOpenChange}
        title="Link existing task"
        query={query}
        onQueryChange={onQueryChange}
        candidates={candidates}
        isFetching={isFetching}
        onSelectCandidate={onSelectCandidate}
      />

      <LinkExistingTaskDialog
        candidate={confirmCandidate}
        parentTaskNumber={parentTaskNumber}
        open={confirmCandidate != null}
        onOpenChange={onConfirmDialogOpenChange}
        onConfirm={onConfirm}
      />
    </>
  )
}
