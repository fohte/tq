import { Button } from '@fohte/ui/button'
import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'
import { useEffect, useId } from 'react'

import { SaveViewButton } from '#components/saved-view/save-view-button'
import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { TaskFilterChip } from '#components/task/task-filter-chip'
import { TaskFilterFreeTextInput } from '#components/task/task-filter-free-text-input'
import { taskFilterAxisIcons } from '#components/task/task-filter-icons'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import { TaskSortFilterFields } from '#components/task/task-sort-filter-fields'
import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'
import { Checkbox } from '#components/ui/checkbox'
import { shouldIgnoreShortcut } from '#hooks/use-global-keybindings'
import type { Project } from '#hooks/use-projects'
import { useSearchModalOpen } from '#hooks/use-search-modal-open'
import { useTask } from '#hooks/use-task-queries'
import {
  defaultTaskSort,
  sortOptionValues,
  statusChipLabels,
  tasksSearchDefaultQuery,
  withDefaultSort,
  withHasPages,
  withLabel,
  withParentId,
  withProjectId,
  withStatus,
} from '#lib/tasks-query'

type TaskFilterKind =
  'status' | 'project' | 'label' | 'pages' | 'parent' | 'sort'

interface TaskFilterChipRowProps {
  onQueryChange: (query: string) => void
  parsed: ParsedQuery
  projects: Project[]
  // Saved views aren't scoped to a project (see api/src/db/schema/core.ts),
  // so a screen whose scope already comes from elsewhere (e.g. the
  // /projects/$projectId route param) hides the button rather than saving a
  // view that silently drops that scope.
  hideSaveView?: boolean
  // A screen whose project scope comes from its route param (e.g.
  // /projects/$projectId) rather than from `parsed`/`q` disables this axis
  // entirely — otherwise a `project:` chip or typed token could suggest the
  // list is scoped to a different project than the one the rest of the
  // screen (title, task summary, "Add task") actually targets.
  disableProjectFilter?: boolean
  disableStatusFilter?: boolean
  disableSortFilter?: boolean
  defaultOpenFilter?: TaskFilterKind
  autoFocus?: boolean
}

export function TaskFilterChipRow({
  onQueryChange,
  parsed,
  projects,
  hideSaveView = false,
  disableProjectFilter = false,
  disableStatusFilter = false,
  disableSortFilter = false,
  defaultOpenFilter,
  autoFocus = false,
}: TaskFilterChipRowProps) {
  const searchModalOpen = useSearchModalOpen()
  const rowId = useId()
  const freeTextInputId = `task-filter-free-text-${rowId}`
  const hasPagesCheckboxId = `${freeTextInputId}-has-pages`

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key !== '/' ||
        e.repeat ||
        searchModalOpen ||
        shouldIgnoreShortcut(e)
      ) {
        return
      }

      const input = document.getElementById(freeTextInputId)
      if (
        !(input instanceof HTMLInputElement) ||
        input.getClientRects().length === 0
      ) {
        return
      }

      e.preventDefault()
      input.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [freeTextInputId, searchModalOpen])

  const sortBy = parsed.sortBy ?? defaultTaskSort
  // Keep the picker selection valid if an older URL contains a removed sort.
  const pickerSortBy =
    sortOptionValues.find((value) => value === sortBy) ?? defaultTaskSort
  const selectedProject = disableProjectFilter
    ? undefined
    : projects.find((project) => project.id === parsed.projectId)

  const parentTaskQuery = useTask(parsed.parentId ?? '', {
    enabled: parsed.parentId != null,
  })

  const setParsed = (next: ParsedQuery) => {
    const filtered = { ...next }
    if (disableStatusFilter) delete filtered.status
    if (disableSortFilter) delete filtered.sortBy
    onQueryChange(
      buildSearchQuery(
        disableSortFilter ? filtered : withDefaultSort(filtered),
      ),
    )
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
    if (
      !disableStatusFilter &&
      typed.status != null &&
      typed.status.length > 0
    ) {
      next = withStatus(next, [
        ...new Set([...(next.status ?? []), ...typed.status]),
      ])
    }
    if (typed.label != null) next = withLabel(next, typed.label)
    if (typed.context != null) next.context = typed.context
    if (typed.hasPages === true) next = withHasPages(next, true)
    if (typed.hasComments === true) next.hasComments = true
    if (typed.hasNoChildren === true) next.hasNoChildren = true
    if (typed.hasBlockers === true) {
      next.hasBlockers = true
      delete next.hasNoBlockers
    }
    if (typed.hasNoBlockers === true) {
      next.hasNoBlockers = true
      delete next.hasBlockers
    }
    if (typed.parentId != null) next = withParentId(next, typed.parentId)
    if (!disableProjectFilter && typed.projectId != null) {
      next = withProjectId(next, typed.projectId)
    }
    if (!disableSortFilter && typed.sortBy != null) {
      next.sortBy = typed.sortBy
    }
    setParsed(next)
  }

  // Backspace on the empty free-text input clears whichever applied
  // condition sits closest to it — i.e. the last chip rendered before the
  // input, in reverse of the render order below.
  const removeLastChip = () => {
    if (!disableSortFilter && sortBy !== defaultTaskSort) {
      setParsed({ ...parsed, sortBy: defaultTaskSort })
    } else if (parsed.parentId != null) {
      setParsed(withParentId(parsed, undefined))
    } else if (parsed.hasPages === true) {
      setParsed(withHasPages(parsed, false))
    } else if (parsed.label != null) {
      setParsed(withLabel(parsed, undefined))
    } else if (selectedProject != null) {
      setParsed(withProjectId(parsed, ''))
    } else if (
      !disableStatusFilter &&
      parsed.status != null &&
      parsed.status.length > 0
    ) {
      setParsed(withStatus(parsed, []))
    }
  }

  const query = buildSearchQuery(withDefaultSort(parsed))
  const statusValue =
    parsed.status?.map((status) => statusChipLabels[status]).join(', ') ?? ''
  const parentValue = parentTaskQuery.isLoading
    ? 'Loading…'
    : (parentTaskQuery.data?.title ?? parsed.parentId ?? '')

  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-border bg-background px-4">
      <label
        htmlFor={freeTextInputId}
        className="shrink-0 cursor-text font-mono text-sm font-bold text-primary"
      >
        <span aria-hidden="true">›</span>
      </label>

      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">
        {!disableStatusFilter &&
          parsed.status != null &&
          parsed.status.length > 0 && (
            <TaskFilterChip
              icon={taskFilterAxisIcons.is}
              attribute="is"
              value={statusValue}
              menuTitle="Status"
              ariaLabel={`is ${statusValue}`}
              defaultOpen={defaultOpenFilter === 'status'}
              onRemove={() => {
                setParsed(withStatus(parsed, []))
              }}
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
            icon={taskFilterAxisIcons.project}
            attribute="project"
            value={selectedProject.title}
            menuTitle="Project"
            ariaLabel={`project ${selectedProject.title}`}
            defaultOpen={defaultOpenFilter === 'project'}
            onRemove={() => {
              setParsed(withProjectId(parsed, ''))
            }}
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
            icon={taskFilterAxisIcons.label}
            attribute="label"
            value={parsed.label}
            menuTitle="Label"
            ariaLabel={`label #${parsed.label}`}
            defaultOpen={defaultOpenFilter === 'label'}
            onRemove={() => {
              setParsed(withLabel(parsed, undefined))
            }}
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
          <TaskFilterChip
            icon={taskFilterAxisIcons.has}
            attribute="has"
            value="pages"
            menuTitle="Pages"
            ariaLabel="has pages"
            defaultOpen={defaultOpenFilter === 'pages'}
            onRemove={() => {
              setParsed(withHasPages(parsed, false))
            }}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id={hasPagesCheckboxId}
                checked
                onCheckedChange={(checked) => {
                  setParsed(withHasPages(parsed, checked))
                }}
              />
              <label
                htmlFor={hasPagesCheckboxId}
                className="text-sm text-foreground"
              >
                has pages
              </label>
            </div>
          </TaskFilterChip>
        )}

        {parsed.parentId != null && (
          <TaskFilterChip
            icon={taskFilterAxisIcons.parent}
            attribute="parent"
            value={parentValue}
            menuTitle="Parent"
            ariaLabel={`parent ${parentValue}`}
            defaultOpen={defaultOpenFilter === 'parent'}
            onRemove={() => {
              setParsed(withParentId(parsed, undefined))
            }}
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

        {!disableSortFilter && (
          <TaskFilterChip
            icon={taskFilterAxisIcons.sort}
            attribute="sort"
            value={sortBy}
            menuTitle="Sort"
            ariaLabel={`Sort by ${sortBy}`}
            defaultOpen={defaultOpenFilter === 'sort'}
            isDefault={sortBy === defaultTaskSort}
            onRemove={
              sortBy === defaultTaskSort
                ? undefined
                : () => {
                    setParsed({ ...parsed, sortBy: defaultTaskSort })
                  }
            }
          >
            <TaskSortFilterFields
              sortBy={pickerSortBy}
              onSortByChange={(sort) => {
                setParsed({ ...parsed, sortBy: sort })
              }}
            />
          </TaskFilterChip>
        )}

        <TaskFilterFreeTextInput
          id={freeTextInputId}
          freeText={parsed.freeText}
          onCommit={commitFreeText}
          onBackspaceEmpty={removeLastChip}
          disabledSuggestionCategories={[
            ...(disableStatusFilter ? ['is'] : []),
            ...(disableSortFilter ? ['sort'] : []),
          ]}
          placeholder="Filter…"
          autoFocus={autoFocus}
          syntaxHelpSections={getSearchSyntaxHelpSections({
            audience: 'task-filter',
            disableProjectFilter,
            disableStatusFilter,
            disableSortFilter,
          })}
        />
      </div>

      {!hideSaveView && query !== tasksSearchDefaultQuery && (
        <SaveViewButton query={query} />
      )}
    </div>
  )
}
