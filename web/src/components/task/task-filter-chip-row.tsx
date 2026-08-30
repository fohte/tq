import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'

import { SaveViewButton } from '#components/saved-view/save-view-button'
import { TaskFilterChip } from '#components/task/task-filter-chip'
import { TaskFilterFreeTextInput } from '#components/task/task-filter-free-text-input'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import { TaskSortFilterFields } from '#components/task/task-sort-filter-fields'
import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import type { Project } from '#hooks/use-projects'
import { useTask } from '#hooks/use-task-queries'
import {
  sortLabels,
  sortOptionValues,
  statusChipLabels,
  withHasPages,
  withLabel,
  withParentId,
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
  // Saved views aren't scoped to a project (see api/src/db/schema/core.ts),
  // so a screen whose scope already comes from elsewhere (e.g. the
  // /projects/$projectId route param) hides the button rather than saving a
  // view that silently drops that scope.
  hideSaveView?: boolean
}

export function TaskFilterChipRow({
  onQueryChange,
  parsed,
  projects,
  hideSaveView = false,
}: TaskFilterChipRowProps) {
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
  // the rest stays as parsed.freeText. Parses only the typed fragment (not
  // parsed re-serialized as a string) so an already-applied `is:` value
  // typed again unions into the existing status array instead of
  // duplicating it — parseSearchQuery accumulates every `is:` token it
  // sees, applied or not.
  const commitFreeText = (freeText: string) => {
    const typed = parseSearchQuery(freeText)
    let next: ParsedQuery = { ...parsed, freeText: typed.freeText }
    if (typed.status != null && typed.status.length > 0) {
      next = withStatus(next, [
        ...new Set([...(next.status ?? []), ...typed.status]),
      ])
    }
    if (typed.label != null) next = withLabel(next, typed.label)
    if (typed.context != null) next.context = typed.context
    if (typed.hasPages === true) next = withHasPages(next, true)
    if (typed.hasComments === true) next.hasComments = true
    if (typed.hasNoChildren === true) next.hasNoChildren = true
    if (typed.parentId != null) next = withParentId(next, typed.parentId)
    if (typed.projectId != null) next = withProjectId(next, typed.projectId)
    if (typed.sortBy != null) next.sortBy = typed.sortBy
    setParsed(next)
  }

  // Backspace on the empty free-text input clears whichever applied
  // condition sits closest to it — i.e. the last chip rendered before the
  // input, in reverse of the render order below.
  const removeLastChip = () => {
    if (parsed.parentId != null) {
      setParsed(withParentId(parsed, undefined))
    } else if (parsed.hasPages === true) {
      setParsed(withHasPages(parsed, false))
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
                  setParsed(withHasPages(parsed, checked))
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
                setParsed(withParentId(parsed, undefined))
              }}
            >
              Clear parent filter
            </Button>
          </TaskFilterChip>
        )}

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

      {!hideSaveView && <SaveViewButton query={buildSearchQuery(parsed)} />}
    </div>
  )
}
