import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'
import { useState } from 'react'

import { TaskFilterChip } from '#components/task/task-filter-chip'
import { TaskFilterMenuContent } from '#components/task/task-filter-menu-content'
import { TaskFilterQueryInput } from '#components/task/task-filter-query-input'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import { TaskSortFilterFields } from '#components/task/task-sort-filter-fields'
import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { Chip } from '#components/ui/chip'
import { FilterMenu } from '#components/ui/filter-menu'
import { useIsDesktop } from '#hooks/use-is-desktop'
import type { Project } from '#hooks/use-projects'
import { useTask } from '#hooks/use-task-queries'
import {
  sortLabels,
  sortOptionValues,
  statusChipLabels,
} from '#lib/tasks-query'
import { cn } from '#lib/utils'

const filterTriggerClassName =
  'shrink-0 cursor-pointer items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground outline-none hover:text-foreground'

interface TaskFilterChipRowProps {
  query: string
  onQueryChange: (query: string) => void
  parsed: ParsedQuery
  projects: Project[]
}

export function TaskFilterChipRow({
  query,
  onQueryChange,
  parsed,
  projects,
}: TaskFilterChipRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const isDesktop = useIsDesktop()

  const sortBy = parsed.sortBy ?? 'updated'
  // The chip label/picker fall back to 'updated' for a sort the picker
  // below doesn't offer (e.g. a hand-edited `sort:due` in the URL); the
  // picker itself only ever offers sortOptionValues, so it takes a narrowed
  // value instead.
  const pickerSortBy =
    sortOptionValues.find((value) => value === sortBy) ?? 'updated'
  const selectedProject = projects.find(
    (project) => project.id === parsed.projectId,
  )
  const freeTextWords =
    parsed.freeText !== ''
      ? parsed.freeText.split(/\s+/).filter((w) => w !== '')
      : []

  const parentTaskQuery = useTask(parsed.parentId ?? '', {
    enabled: parsed.parentId != null,
  })

  const setParsed = (next: ParsedQuery) => {
    onQueryChange(buildSearchQuery(next))
  }

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
    <div className="flex items-start gap-1.5 border-b border-border px-3 py-2">
      {/* PC: click to edit the query directly. Kept as its own flex item
          (not inside the wrapping chip area below) so a future edit-mode
          toggle can grow here without touching the chip/sort layout. */}
      <button
        type="button"
        onClick={() => {
          setIsEditing(true)
        }}
        className={cn('hidden shrink-0 md:inline-flex', filterTriggerClassName)}
      >
        <span aria-hidden="true">&gt;</span>
        <span className="sr-only">Edit filter query</span>
      </button>

      {/* Wraps onto multiple lines as conditions accumulate, instead of
          scrolling horizontally and hiding chips off-screen. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {parsed.status != null && parsed.status.length > 0 && (
          <TaskFilterChip
            attribute="is"
            value={parsed.status
              .map((status) => statusChipLabels[status])
              .join(', ')}
            menuTitle="Status"
          >
            <TaskStatusFilterFields
              status={parsed.status}
              onStatusChange={(status) => {
                const next = { ...parsed }
                if (status.length === 0) delete next.status
                else next.status = status
                setParsed(next)
              }}
            />
          </TaskFilterChip>
        )}

        {selectedProject != null && (
          <TaskFilterChip
            attribute="project"
            value={selectedProject.title}
            menuTitle="Project"
          >
            <TaskProjectFilterFields
              projects={projects}
              selectedProjectId={parsed.projectId}
              onProjectIdChange={(id) => {
                const next = { ...parsed }
                if (id === '') delete next.projectId
                else next.projectId = id
                setParsed(next)
              }}
            />
          </TaskFilterChip>
        )}

        {parsed.label != null && (
          <TaskFilterChip
            attribute="label"
            value={`#${parsed.label}`}
            menuTitle="Label"
          >
            <TaskLabelFilterFields
              selectedLabel={parsed.label}
              onLabelChange={(label) => {
                const next = { ...parsed }
                if (label == null) delete next.label
                else next.label = label
                setParsed(next)
              }}
            />
          </TaskFilterChip>
        )}

        {parsed.hasPages === true && (
          <TaskFilterChip attribute="has" value="pages" menuTitle="Pages">
            <div className="flex items-center gap-2">
              <Checkbox
                id="task-filter-has-pages"
                checked
                onCheckedChange={(checked) => {
                  const next = { ...parsed }
                  if (checked) next.hasPages = true
                  else delete next.hasPages
                  setParsed(next)
                }}
              />
              <label
                htmlFor="task-filter-has-pages"
                className="text-sm text-foreground"
              >
                has pages
              </label>
            </div>
          </TaskFilterChip>
        )}

        {parsed.parentId != null && (
          <TaskFilterChip
            attribute="parent"
            value={
              parentTaskQuery.isLoading
                ? 'Loading…'
                : (parentTaskQuery.data?.title ?? parsed.parentId)
            }
            menuTitle="Parent"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = { ...parsed }
                delete next.parentId
                setParsed(next)
              }}
            >
              Clear parent filter
            </Button>
          </TaskFilterChip>
        )}

        {freeTextWords.map((word, index) => (
          <Chip
            key={`${word}-${String(index)}`}
            as="button"
            active
            className="shrink-0"
            onClick={() => {
              const remaining = freeTextWords.filter((_, i) => i !== index)
              setParsed({ ...parsed, freeText: remaining.join(' ') })
            }}
          >
            {word} ×
          </Chip>
        ))}

        <FilterMenu
          trigger="+ filter"
          triggerClassName={cn('inline-flex shrink-0', filterTriggerClassName)}
          title="Filter"
        >
          <TaskFilterMenuContent
            parsed={parsed}
            onQueryChange={onQueryChange}
            projects={projects}
            showContext={!isDesktop}
          />
        </FilterMenu>
      </div>

      {/* Pinned to the row's right edge, outside the wrapping chip area, so
          it stays put at the top-right even once the chips wrap to a second
          line. Below `md` the value is dropped to save width — same
          control, same menu, just a shorter label. */}
      <TaskFilterChip
        attribute={
          <>
            <span className="sr-only">Sort by</span>
            <span aria-hidden="true">↕</span>
          </>
        }
        value={
          <span className="hidden md:inline">
            {sortLabels[sortBy] ?? sortBy}
          </span>
        }
        menuTitle="Sort"
        className="shrink-0"
      >
        <TaskSortFilterFields
          sortBy={pickerSortBy}
          onSortByChange={(sort) => {
            setParsed({ ...parsed, sortBy: sort })
          }}
        />
      </TaskFilterChip>
    </div>
  )
}
