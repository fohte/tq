import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'
import { useState } from 'react'

import { TaskFilterMenuContent } from '#components/task/task-filter-menu-content'
import { TaskFilterQueryInput } from '#components/task/task-filter-query-input'
import { Chip } from '#components/ui/chip'
import { FilterMenu } from '#components/ui/filter-menu'
import { useIsDesktop } from '#hooks/use-is-desktop'
import type { Project } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { sortLabels, sortOptionValues } from '#lib/tasks-query'
import { cn } from '#lib/utils'

const filterTriggerClassName =
  'shrink-0 cursor-pointer items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground outline-none hover:text-foreground'

interface TaskFilterChipRowProps {
  query: string
  onQueryChange: (query: string) => void
  parsed: ParsedQuery
  onShowCompletedChange: (checked: boolean) => void
  onSortByChange: (sortBy: TaskSortBy) => void
  projects: Project[]
  onProjectIdChange: (id: string) => void
  onTagChange: (tag: string | undefined) => void
}

export function TaskFilterChipRow({
  query,
  onQueryChange,
  parsed,
  onShowCompletedChange,
  onSortByChange,
  projects,
  onProjectIdChange,
  onTagChange,
}: TaskFilterChipRowProps) {
  const showCompleted = parsed.status == null
  // The chip label falls back to the raw value for a sort the picker below
  // doesn't offer (e.g. a hand-edited `sort:due` in the URL), but the picker
  // controls themselves only ever offer sortOptionValues, so they take a
  // narrowed value instead.
  const sortBy = parsed.sortBy ?? 'updated'
  const pickerSortBy =
    sortOptionValues.find((value) => value === sortBy) ?? 'updated'
  const tag = parsed.label
  const selectedProject = projects.find(
    (project) => project.id === parsed.projectId,
  )
  const freeTextWords =
    parsed.freeText !== ''
      ? parsed.freeText.split(/\s+/).filter((w) => w !== '')
      : []
  const [isEditing, setIsEditing] = useState(false)
  const isDesktop = useIsDesktop()

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <TaskFilterQueryInput
          query={query}
          onCommit={(newQuery) => {
            onQueryChange(newQuery)
            setIsEditing(false)
          }}
          onCancel={() => {
            setIsEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
      {!showCompleted && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onShowCompletedChange(true)
          }}
        >
          not completed ×
        </Chip>
      )}
      <Chip active className="shrink-0">
        sort: {sortLabels[sortBy] ?? sortBy}
      </Chip>
      {selectedProject != null && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onProjectIdChange('')
          }}
        >
          project: {selectedProject.title} ×
        </Chip>
      )}
      {tag != null && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onTagChange(undefined)
          }}
        >
          #{tag} ×
        </Chip>
      )}
      {parsed.hasPages === true && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            // exactOptionalPropertyTypes forbids `{ ...parsed, hasPages:
            // undefined }` (hasPages's type is `boolean`, not `boolean |
            // undefined`) — delete is the sanctioned way to unset an
            // optional property under that flag.
            const next = { ...parsed }
            delete next.hasPages
            onQueryChange(buildSearchQuery(next))
          }}
        >
          has:pages ×
        </Chip>
      )}
      {parsed.parentId != null && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            const next = { ...parsed }
            delete next.parentId
            onQueryChange(buildSearchQuery(next))
          }}
        >
          parent:{parsed.parentId} ×
        </Chip>
      )}
      {freeTextWords.map((word, index) => (
        <Chip
          key={`${word}-${String(index)}`}
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            const remaining = freeTextWords.filter((_, i) => i !== index)
            onQueryChange(
              buildSearchQuery({ ...parsed, freeText: remaining.join(' ') }),
            )
          }}
        >
          {word} ×
        </Chip>
      ))}

      {/* PC: click to edit the query directly */}
      <button
        type="button"
        onClick={() => {
          setIsEditing(true)
        }}
        className={cn('hidden md:inline-flex', filterTriggerClassName)}
      >
        <span aria-hidden="true">&gt;</span>
        <span className="sr-only">Edit filter query</span>
      </button>

      <FilterMenu
        trigger="+ filter"
        triggerClassName={cn('inline-flex', filterTriggerClassName)}
        title="Filter"
      >
        <TaskFilterMenuContent
          showCompleted={showCompleted}
          onShowCompletedChange={onShowCompletedChange}
          sortBy={pickerSortBy}
          onSortByChange={onSortByChange}
          projects={projects}
          selectedProjectId={parsed.projectId}
          onProjectIdChange={onProjectIdChange}
          showContext={!isDesktop}
        />
      </FilterMenu>
    </div>
  )
}
