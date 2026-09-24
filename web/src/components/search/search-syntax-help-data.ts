import { getSearchQueryHelpTokens } from 'api/search-query-parser'

import { SEARCH_MODE_DEFINITIONS } from '#components/search/search-modal-mode'

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
}: {
  audience?: 'search' | 'task-filter'
  disableProjectFilter?: boolean
} = {}): SearchSyntaxHelpSection[] {
  const queryTokens = getSearchQueryHelpTokens()
  const filterTokens =
    audience === 'task-filter'
      ? queryTokens.filter(
          (token) =>
            token.taskFilter &&
            !(disableProjectFilter && token.key === 'project'),
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
