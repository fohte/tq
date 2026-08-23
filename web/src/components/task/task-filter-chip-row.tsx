import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'

import { TaskFilterChip } from '#components/task/task-filter-chip'
import { TaskFilterFreeTextInput } from '#components/task/task-filter-free-text-input'
import { TaskFilterMenuContent } from '#components/task/task-filter-menu-content'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import { TaskSortFilterFields } from '#components/task/task-sort-filter-fields'
import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { FilterMenu } from '#components/ui/filter-menu'
import { useIsDesktop } from '#hooks/use-is-desktop'
import type { Project } from '#hooks/use-projects'
import { useTask } from '#hooks/use-task-queries'
import {
  sortLabels,
  sortOptionValues,
  statusChipLabels,
  withLabel,
  withProjectId,
  withStatus,
} from '#lib/tasks-query'
import { cn } from '#lib/utils'

const filterTriggerClassName =
  'shrink-0 cursor-pointer items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground outline-none hover:text-foreground'

const freeTextInputId = 'task-filter-free-text'

interface TaskFilterChipRowProps {
  onQueryChange: (query: string) => void
  parsed: ParsedQuery
  projects: Project[]
}

export function TaskFilterChipRow({
  onQueryChange,
  parsed,
  projects,
}: TaskFilterChipRowProps) {
  const isDesktop = useIsDesktop()

  const sortBy = parsed.sortBy ?? 'updated'
  // The chip label falls back to the raw value for a sort the picker below
  // doesn't offer (e.g. a hand-edited `sort:due` in the URL), but the
  // picker itself only ever offers sortOptionValues, so it takes a
  // narrowed value instead.
  const pickerSortBy =
    sortOptionValues.find((value) => value === sortBy) ?? 'updated'
  const selectedProject = projects.find(
    (project) => project.id === parsed.projectId,
  )

  const parentTaskQuery = useTask(parsed.parentId ?? '', {
    enabled: parsed.parentId != null,
  })

  const setParsed = (next: ParsedQuery) => {
    onQueryChange(buildSearchQuery(next))
  }

  // Merges newly typed free text back into the applied query: anything that
  // parses as a structured `key:value` token is lifted out as a condition,
  // the rest round-trips back into parsed.freeText.
  const commitFreeText = (freeText: string) => {
    const structuredOnly = buildSearchQuery({ ...parsed, freeText: '' })
    setParsed(parseSearchQuery(`${structuredOnly} ${freeText}`.trim()))
  }

  // Backspace on the empty free-text input clears whichever applied
  // condition sits closest to it — i.e. the last chip rendered before the
  // input, in reverse of the render order below.
  const removeLastChip = () => {
    if (parsed.parentId != null) {
      const next = { ...parsed }
      delete next.parentId
      setParsed(next)
    } else if (parsed.hasPages === true) {
      const next = { ...parsed }
      delete next.hasPages
      setParsed(next)
    } else if (parsed.label != null) {
      setParsed(withLabel(parsed, undefined))
    } else if (selectedProject != null) {
      setParsed(withProjectId(parsed, ''))
    } else if (parsed.status != null && parsed.status.length > 0) {
      setParsed(withStatus(parsed, []))
    }
  }

  return (
    <div className="flex items-start gap-1.5 border-b border-border px-3 py-2">
      {/* Always-visible left column marking the row as a token input.
          Kept as its own flex item (not inside the wrapping chip area
          below) so a wrapped second line hangs indented under it instead
          of tucking underneath. Clicking it focuses the free-text input
          via the native label/input association below — no JS needed. */}
      <label
        htmlFor={freeTextInputId}
        className={cn(
          'inline-flex shrink-0 cursor-text',
          filterTriggerClassName,
        )}
      >
        <span aria-hidden="true">&gt;</span>
      </label>

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
                setParsed(withStatus(parsed, status))
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
                setParsed(withProjectId(parsed, id))
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
                setParsed(withLabel(parsed, label))
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

        <TaskFilterFreeTextInput
          id={freeTextInputId}
          freeText={parsed.freeText}
          onCommit={commitFreeText}
          onBackspaceEmpty={removeLastChip}
          placeholder="Filter…"
        />
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
