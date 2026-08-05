import type { SearchResult } from '#hooks/use-search'
import { cn } from '#lib/utils'

export function TaskCandidateList({
  candidates,
  highlightedIndex,
  indexOffset = 0,
  onSelectCandidate,
  onHighlightCandidate,
}: {
  candidates: SearchResult[]
  highlightedIndex: number
  /** Offset added to a candidate's array position before comparing to `highlightedIndex` — lets a caller reserve leading indices (e.g. index 0) for its own rows above this list. */
  indexOffset?: number
  onSelectCandidate: (candidate: SearchResult) => void
  onHighlightCandidate?: (index: number) => void
}) {
  return (
    <>
      {candidates.map((candidate, index) => (
        <button
          key={candidate.id}
          type="button"
          className={cn(
            'flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm',
            highlightedIndex === index + indexOffset
              ? 'bg-accent text-accent-foreground'
              : 'text-popover-foreground hover:bg-accent/50',
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelectCandidate(candidate)
          }}
          onMouseEnter={() => {
            onHighlightCandidate?.(index + indexOffset)
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
    </>
  )
}
