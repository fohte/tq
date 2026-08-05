import { TaskCandidateList } from '#components/task/task-candidate-list'
import type { SearchResult } from '#hooks/use-search'

// The dropdown shown while the `^` trigger is active in `CreateTaskInline`,
// letting the user pick a parent for the task being created.
export function CreateTaskInlineParentMenu({
  candidates,
  highlightedIndex,
  isLoading,
  onSelectCandidate,
}: {
  candidates: SearchResult[]
  highlightedIndex: number
  isLoading: boolean
  onSelectCandidate: (candidate: SearchResult) => void
}) {
  return (
    <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-md border border-border bg-popover py-1 font-mono shadow-md">
      {isLoading ? (
        <div className="px-3 py-1.5 text-sm text-muted-foreground">
          Searching...
        </div>
      ) : candidates.length === 0 ? (
        <div className="px-3 py-1.5 text-sm text-muted-foreground">
          No matching tasks
        </div>
      ) : (
        <TaskCandidateList
          candidates={candidates}
          highlightedIndex={highlightedIndex}
          indexOffset={0}
          onSelectCandidate={onSelectCandidate}
        />
      )}
    </div>
  )
}
