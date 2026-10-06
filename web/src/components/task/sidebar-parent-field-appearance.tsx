import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { List, ListItem } from '@fohte/ui/list'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { useRef } from 'react'

import {
  SidebarField,
  sidebarFieldValueButtonClassName,
} from '#components/task/sidebar-field'
import { TaskCandidateList } from '#components/task/task-candidate-list'
import type { SearchResult } from '#hooks/use-search'

export function SidebarParentFieldAppearance({
  currentParent,
  isEditing,
  onOpenChange,
  query,
  onQueryChange,
  isFetching,
  candidates,
  onClear,
  onSelectCandidate,
}: {
  currentParent: { number: number; title: string } | null
  isEditing: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (value: string) => void
  isFetching: boolean
  candidates: SearchResult[]
  onClear: () => void
  onSelectCandidate: (candidate: SearchResult) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <SidebarField label="PARENT">
      {isEditing ? (
        <div className="px-1">
          <Input
            ref={inputRef}
            type="text"
            variant="ghost"
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value)
            }}
            onBlur={() => {
              onOpenChange(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onOpenChange(false)
              }
            }}
            placeholder="Search tasks..."
            autoFocus
            className="w-full"
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onOpenChange(true)
          }}
          className={`${sidebarFieldValueButtonClassName} min-w-0`}
        >
          <span className="min-w-0 truncate">
            {currentParent != null
              ? `#${String(currentParent.number)} ${currentParent.title}`
              : '—'}
          </span>
        </Button>
      )}
      <Popover
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) onOpenChange(false)
        }}
        anchor={inputRef}
      >
        <PopoverContent
          // Base UI's popover moves focus to the popup's first focusable
          // element (the clear option below) as soon as it opens. That races
          // the anchor `Input`'s own `autoFocus` and steals keystrokes away
          // from it, so keep focus on the input instead.
          initialFocus={false}
          padding="none"
          className="w-72 text-popover-foreground"
        >
          <List
            onMouseDown={(event) => {
              event.preventDefault()
            }}
          >
            <ListItem onSelect={onClear}>—</ListItem>
          </List>
          <div className="mt-1 border-t border-border pt-1">
            {query === '' ? (
              <div className="px-3 py-1.5 text-sm text-muted-foreground">
                Type to search...
              </div>
            ) : isFetching ? (
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
                highlightedIndex={-1}
                indexOffset={1}
                onSelectCandidate={onSelectCandidate}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </SidebarField>
  )
}
