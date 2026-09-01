import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'

import type { TaskSortBy } from '#hooks/use-tasks'

export const sortOptionValues = [
  'updated',
  'due',
  'estimate',
  'created',
] as const satisfies readonly TaskSortBy[]

export const sortLabels: Partial<
  Record<NonNullable<ParsedQuery['sortBy']>, string>
> = {
  updated: 'Updated',
  due: 'Due',
  estimate: 'Estimate',
  created: 'Created',
}

// Compact terms for the `is` chip's value (e.g. "is todo, doing"), distinct
// from the full "In Progress"-style wording used in status pickers.
export const statusChipLabels: Record<
  NonNullable<ParsedQuery['status']>[number],
  string
> = {
  todo: 'todo',
  completed: 'done',
}

// One delete-or-set helper per structured ParsedQuery field, shared by
// TaskFilterChipRow's per-axis chips and its free-text token input so both
// build the exact same next-query shape.
export function withStatus(
  parsed: ParsedQuery,
  status: NonNullable<ParsedQuery['status']>,
): ParsedQuery {
  const next = { ...parsed }
  if (status.length === 0) delete next.status
  else next.status = status
  return next
}

export function withProjectId(
  parsed: ParsedQuery,
  projectId: string,
): ParsedQuery {
  const next = { ...parsed }
  if (projectId === '') delete next.projectId
  else next.projectId = projectId
  return next
}

export function withLabel(
  parsed: ParsedQuery,
  label: string | undefined,
): ParsedQuery {
  const next = { ...parsed }
  if (label == null) delete next.label
  else next.label = label
  return next
}

export function withHasPages(
  parsed: ParsedQuery,
  hasPages: boolean,
): ParsedQuery {
  const next = { ...parsed }
  if (hasPages) next.hasPages = true
  else delete next.hasPages
  return next
}

export function withParentId(
  parsed: ParsedQuery,
  parentId: string | undefined,
): ParsedQuery {
  const next = { ...parsed }
  if (parentId == null) delete next.parentId
  else next.parentId = parentId
  return next
}

// The /tasks search for "default filters, scoped to this tag" — shared by
// every tag-token click/link (sidebar, task row, task detail) so they all
// navigate to the same place.
export function tagFilterSearch(tag: string): { q: string } {
  return {
    q: buildSearchQuery({
      freeText: '',
      status: ['todo'],
      label: tag,
      sortBy: 'updated',
    }),
  }
}
