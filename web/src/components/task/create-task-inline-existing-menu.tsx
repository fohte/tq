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
        <div className="px-3 py-1 text-[10px] tracking-[0.08em] text-muted-foreground-faint">
          EXISTING
        </div>
        {candidates.map((candidate, index) => (
          <button
            key={candidate.id}
            type="button"
            className={cn(
              'flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm',
              highlightedIndex === index + 1
                ? 'bg-accent text-accent-foreground'
                : 'text-popover-foreground hover:bg-accent/50',
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelectCandidate(candidate)
            }}
          >
            <span className="shrink-0 text-muted-foreground-faint">
              #{candidate.number}
            </span>
            <span className="truncate">{candidate.title}</span>
            {candidate.parentId != null && candidate.parentNumber != null && (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground-faint">
                ← #{candidate.parentNumber}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
