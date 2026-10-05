import { List, ListItem } from '@fohte/ui/list'

import type { SearchResult } from '#hooks/use-search'

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
    <List
      onMouseDown={(event) => {
        event.preventDefault()
      }}
    >
      {candidates.map((candidate, index) => (
        <ListItem
          key={candidate.id}
          highlighted={highlightedIndex === index + indexOffset}
          onSelect={() => {
            onSelectCandidate(candidate)
          }}
          onMouseEnter={() => {
            onHighlightCandidate?.(index + indexOffset)
          }}
        >
          <span className="shrink-0 text-muted-foreground-faint">
            #{candidate.number}
          </span>
          <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
          {candidate.parentId != null && candidate.parentNumber != null && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground-faint">
              ← #{candidate.parentNumber}
            </span>
          )}
        </ListItem>
      ))}
    </List>
  )
}
