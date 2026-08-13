import type { RefObject } from 'react'

import { TaskCandidateList } from '#components/task/task-candidate-list'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import type { SearchResult } from '#hooks/use-search'
import { cn } from '#lib/utils'

// The combined CREATE/EXISTING dropdown shown while typing a subtask title
// that matches other tasks. Index 0 is always the CREATE row; indices
// 1..N map to `candidates` in display order — see `CreateTaskInline`'s
// keyboard handling for how `highlightedIndex` is driven.
export function CreateTaskInlineExistingMenu({
  anchor,
  open,
  onOpenChange,
  title,
  candidates,
  highlightedIndex,
  onSelectCandidate,
}: {
  anchor: RefObject<HTMLInputElement | null>
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  candidates: SearchResult[]
  highlightedIndex: number
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
      <div
        className={cn(
          'w-full px-3 py-1.5 text-left text-sm',
          highlightedIndex === 0
            ? 'bg-accent text-accent-foreground'
            : 'text-popover-foreground',
        )}
      >
        Create &quot;{title}&quot;
      </div>

      <div className="mt-1 border-t border-border pt-1">
        <div className="px-3 py-1 text-2xs tracking-widest text-muted-foreground-faint">
          EXISTING
        </div>
        <TaskCandidateList
          candidates={candidates}
          highlightedIndex={highlightedIndex}
          indexOffset={1}
          onSelectCandidate={onSelectCandidate}
        />
      </div>
    </AnchoredPopup>
  )
}
