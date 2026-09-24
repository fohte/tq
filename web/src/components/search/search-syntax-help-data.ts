import { getSearchQueryHelpTokens } from 'api/search-query-parser'

import { SEARCH_MODE_DEFINITIONS } from '#components/search/search-modal-mode'

export interface SearchSyntaxHelpEntry {
  syntax: string
  label?: string
  description: string
  values: { syntax: string; display: string }[]
}

export interface SearchSyntaxHelpSection {
  title: string
  entries: SearchSyntaxHelpEntry[]
}

export function getSearchSyntaxHelpSections(): SearchSyntaxHelpSection[] {
  return [
    {
      title: 'Search targets',
      entries: Object.entries(SEARCH_MODE_DEFINITIONS).map(
        ([prefix, definition]) => ({
          syntax: prefix,
          label: definition.label,
          description: definition.description,
          values: [],
        }),
      ),
    },
    {
      title: 'Filters',
      entries: getSearchQueryHelpTokens().map((token) => ({
        syntax: token.syntax,
        description: token.description,
        values: token.values,
      })),
    },
  ]
}
