import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'

import type { TaskSortBy } from '#hooks/use-tasks'

export const sortOptionValues = [
  'updated',
  'created',
] as const satisfies readonly TaskSortBy[]

export const sortLabels: Partial<
  Record<NonNullable<ParsedQuery['sortBy']>, string>
> = {
  updated: 'Updated',
  created: 'Created',
}

// The /tasks search for "default filters, scoped to this tag" — shared by
// every tag-token click/link (sidebar, task row, task detail) so they all
// navigate to the same place.
export function tagFilterSearch(tag: string): { q: string } {
  return {
    q: buildSearchQuery({
      freeText: '',
      status: ['todo', 'in_progress'],
      label: tag,
      sortBy: 'updated',
    }),
  }
}
