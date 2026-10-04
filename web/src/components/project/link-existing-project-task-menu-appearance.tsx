import { LinkExistingProjectTaskDialog } from '#components/project/link-existing-project-task-dialog'
import { TaskSearchCandidateDialogAppearance } from '#components/task/task-search-candidate-dialog'
import type { SearchResult } from '#hooks/use-search'

export function LinkExistingProjectTaskMenuAppearance({
  open,
  onOpenChange,
  query,
  onQueryChange,
  candidates,
  isFetching,
  onSelectCandidate,
  confirmCandidate,
  currentProjectTitle,
  projectTitle,
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
  currentProjectTitle: string | undefined
  projectTitle: string
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

      <LinkExistingProjectTaskDialog
        candidate={confirmCandidate}
        currentProjectTitle={currentProjectTitle}
        projectTitle={projectTitle}
        open={confirmCandidate != null}
        onOpenChange={onConfirmDialogOpenChange}
        onConfirm={onConfirm}
      />
    </>
  )
}
