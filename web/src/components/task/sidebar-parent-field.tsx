import { useState } from 'react'

import {
  fieldValueClassName,
  SidebarField,
} from '#components/task/sidebar-field'
import { TaskCandidateList } from '#components/task/task-candidate-list'
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
        <div className="relative">
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
            onBlur={stopEditing}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                stopEditing()
              }
            }}
            placeholder="Search tasks..."
            autoFocus
            className={fieldValueClassName}
          />
          <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-md border border-border bg-popover py-1 font-mono shadow-md">
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
          </div>
        </div>
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
    </SidebarField>
  )
}
