import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import { useEffect, useState } from 'react'

import { type SearchResult, useSearchTasks } from '#hooks/use-search'

export function TaskSearchCandidateDialogAppearance({
  open,
  onOpenChange,
  title,
  query,
  onQueryChange,
  candidates,
  isFetching,
  onSelectCandidate,
  skipAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  query: string
  onQueryChange: (query: string) => void
  candidates: SearchResult[]
  isFetching: boolean
  onSelectCandidate: (candidate: SearchResult) => void
  skipAction?: { label: string; onSkip: () => void } | undefined
}) {
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
            onQueryChange(e.target.value)
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
              <Button
                key={candidate.id}
                type="button"
                variant="ghost"
                className="h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-popover-foreground hover:bg-accent/50"
                onClick={() => {
                  onSelectCandidate(candidate)
                }}
              >
                <span className="shrink-0 text-muted-foreground-faint">
                  #{candidate.number}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {candidate.title}
                </span>
                {candidate.parentId != null &&
                  candidate.parentNumber != null && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground-faint">
                      ← #{candidate.parentNumber}
                    </span>
                  )}
              </Button>
            ))
          )}
        </div>

        {skipAction != null && (
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-0 shrink whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 min-h-11 w-full border-t border-border px-3 text-center text-sm text-muted-foreground hover:bg-accent/50"
            onClick={skipAction.onSkip}
          >
            {skipAction.label}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function TaskSearchCandidateDialog({
  open,
  onOpenChange,
  title,
  excludedTaskIds,
  onSelectCandidate,
  skipAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  excludedTaskIds: Set<string>
  onSelectCandidate: (candidate: SearchResult) => void
  skipAction?: { label: string; onSkip: () => void }
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
    <TaskSearchCandidateDialogAppearance
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      query={query}
      onQueryChange={setQuery}
      candidates={candidates}
      isFetching={isFetching}
      onSelectCandidate={onSelectCandidate}
      skipAction={skipAction}
    />
  )
}
