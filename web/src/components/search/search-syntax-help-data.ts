import { getSearchQueryHelpTokens } from 'api/search-query-parser'

import { SEARCH_MODE_DEFINITIONS } from '#components/search/search-modal-mode'
import { legacyTaskSortBy, legacyTaskSortSyntax } from '#lib/tasks-query'

interface SearchSyntaxHelpEntry {
  syntax: string
  label?: string
  description: string
  values: { syntax: string; display: string }[]
}

export interface SearchSyntaxHelpSection {
  title: string
  entries: SearchSyntaxHelpEntry[]
}

export function getSearchSyntaxHelpSections({
  audience = 'search',
  disableProjectFilter = false,
  disableStatusFilter = false,
  disableSortFilter = false,
}: {
  audience?: 'search' | 'task-filter'
  disableProjectFilter?: boolean
  disableStatusFilter?: boolean
  disableSortFilter?: boolean
} = {}): SearchSyntaxHelpSection[] {
  const queryTokens = getSearchQueryHelpTokens().map((token) => {
    if (token.key !== 'sort') return token

    return {
      ...token,
      description: token.description.replace(` or ${legacyTaskSortBy}.`, '.'),
      values: token.values.filter(
        ({ syntax }) => syntax !== legacyTaskSortSyntax,
      ),
    }
  })
  const filterTokens =
    audience === 'task-filter'
      ? queryTokens.filter(
          (token) =>
            token.taskFilter &&
            !(disableProjectFilter && token.key === 'project') &&
            !(disableStatusFilter && token.key === 'is') &&
            !(disableSortFilter && token.key === 'sort'),
        )
      : queryTokens

  const sections: SearchSyntaxHelpSection[] = []
  if (audience === 'search') {
    sections.push({
      title: 'Search targets',
      entries: Object.entries(SEARCH_MODE_DEFINITIONS).map(
        ([prefix, definition]) => ({
          syntax: prefix,
          label: definition.label,
          description: definition.description,
          values: [],
        }),
      ),
    })
  }
  sections.push({ title: 'Filters', entries: filterTokens })
  return sections
}
