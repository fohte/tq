import type { RefObject } from 'react'

import { TaskCandidateList } from '#components/task/task-candidate-list'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import type { SearchResult } from '#hooks/use-search'

export function CreateTaskInlineParentMenu({
  anchor,
  open,
  onOpenChange,
  candidates,
  highlightedIndex,
  isLoading,
  onSelectCandidate,
}: {
  anchor: RefObject<HTMLInputElement | null>
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: SearchResult[]
  highlightedIndex: number
  isLoading: boolean
  onSelectCandidate: (candidate: SearchResult) => void
}) {
  return (
    <AnchoredPopup
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      // The popup opens while the input keeps typing focus — Base UI's
      // default initial-focus behavior would otherwise steal focus onto the
      // first candidate button and break arrow-key navigation.
      initialFocus={false}
      className="w-72"
    >
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
    </AnchoredPopup>
  )
}
