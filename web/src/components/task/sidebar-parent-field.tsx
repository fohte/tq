import { useRef, useState } from 'react'

import {
  fieldValueClassName,
  SidebarField,
} from '#components/task/sidebar-field'
import { TaskCandidateList } from '#components/task/task-candidate-list'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Input } from '#components/ui/input'
import type { SearchResult } from '#hooks/use-search'
import { useSearchTasks } from '#hooks/use-search'
import { useTaskList, useUpdateTaskParent } from '#hooks/use-tasks'
import { getDescendantIds } from '#lib/task-tree'

export function SidebarParentField({
  taskId,
  parentId,
}: {
  taskId: string
  parentId: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { categorized } = useTaskList()
  const updateParent = useUpdateTaskParent()

  const allTasks = categorized.all
  const invalidParentIds = new Set([
    taskId,
    ...getDescendantIds(allTasks, taskId),
  ])
  const currentParent = allTasks.find((t) => t.id === parentId)

  const { data: searchResults, isFetching } = useSearchTasks(query)
  const candidates = (searchResults ?? []).filter(
    (t) => !invalidParentIds.has(t.id),
  )

  const stopEditing = () => {
    setIsEditing(false)
    setQuery('')
  }

  const clearParent = () => {
    updateParent.mutate({ id: taskId, parentId: null })
    stopEditing()
  }

  const selectCandidate = (candidate: SearchResult) => {
    updateParent.mutate({ id: taskId, parentId: candidate.id })
    stopEditing()
  }

  return (
    <SidebarField label="PARENT">
      {isEditing ? (
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          placeholder="Search tasks..."
          autoFocus
          className={fieldValueClassName}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
          className="w-full cursor-text truncate text-left transition-colors hover:text-muted-foreground-strong"
        >
          {currentParent != null
            ? `#${String(currentParent.number)} ${currentParent.title}`
            : '—'}
        </button>
      )}
      <AnchoredPopup
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) stopEditing()
        }}
        anchor={inputRef}
        // Base UI's popover moves focus to the popup's first focusable
        // element (the clear button below) as soon as it opens. That races
        // the anchor `Input`'s own `autoFocus` and steals keystrokes away
        // from it, so keep focus on the input instead.
        initialFocus={false}
        className="w-72"
      >
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent/50"
          onMouseDown={(e) => {
            e.preventDefault()
            clearParent()
          }}
        >
          —
        </button>
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
              onSelectCandidate={selectCandidate}
            />
          )}
        </div>
      </AnchoredPopup>
    </SidebarField>
  )
}
