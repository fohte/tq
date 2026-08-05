import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'

export function TaskSearchCandidateDialog({
  open,
  onOpenChange,
  title,
  excludedTaskIds,
  onSelectCandidate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  excludedTaskIds: Set<string>
  onSelectCandidate: (candidate: SearchResult) => void
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) {
      setQuery('')
    }
  }, [open])

  const { data: searchResults, isFetching } = useSearchTasks(query)

  const candidates = (searchResults ?? []).filter(
    (t) => !excludedTaskIds.has(t.id),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          placeholder="Search tasks..."
          autoFocus
        />

        <div className="max-h-72 overflow-y-auto">
          {query.trim() === '' ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
              Type to search tasks
            </div>
          ) : candidates.length === 0 && !isFetching ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
              {`no results for "${query}"`}
            </div>
          ) : (
            candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-popover-foreground hover:bg-accent/50"
                onClick={() => {
                  onSelectCandidate(candidate)
                }}
              >
                <span className="shrink-0 text-muted-foreground-faint">
                  #{candidate.number}
                </span>
                <span className="truncate">{candidate.title}</span>
                {candidate.parentId != null &&
                  candidate.parentNumber != null && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground-faint">
                      ← #{candidate.parentNumber}
                    </span>
                  )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
