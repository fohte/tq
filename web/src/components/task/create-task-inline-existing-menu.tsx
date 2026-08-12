import { TaskCandidateList } from '#components/task/task-candidate-list'
import type { SearchResult } from '#hooks/use-search'
import { cn } from '#lib/utils'

// The combined CREATE/EXISTING dropdown shown while typing a subtask title
// that matches other tasks. Index 0 is always the CREATE row; indices
// 1..N map to `candidates` in display order — see `CreateTaskInline`'s
// keyboard handling for how `highlightedIndex` is driven.
export function CreateTaskInlineExistingMenu({
  title,
  candidates,
  highlightedIndex,
  onSelectCandidate,
}: {
  title: string
  candidates: SearchResult[]
  highlightedIndex: number
  onSelectCandidate: (candidate: SearchResult) => void
}) {
  return (
    <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-md border border-border bg-popover py-1 font-mono shadow-md">
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
    </div>
  )
}
