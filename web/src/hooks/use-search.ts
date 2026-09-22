import { useQuery } from '@tanstack/react-query'
import { parseSearchQuery } from 'api/search-query-parser'
import type { InferResponseType } from 'hono/client'

import { useDebounce } from '#hooks/use-debounce'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

type SearchResult = InferResponseType<typeof api.api.tasks.$get, 200>[number]

type Suggestion = InferResponseType<
  (typeof api.api.tasks.search)['suggest']['$get'],
  200
>[number]
type PageSearchResult = InferResponseType<
  (typeof api.api.tasks.search)['pages']['$get'],
  200
>['results'][number]
type SearchContext = 'work' | 'personal'

export type { PageSearchResult, SearchResult, Suggestion }

export const searchKeys = {
  all: ['search'] as const,
  results: (q: string, context: SearchContext | undefined) =>
    [...searchKeys.all, 'results', q, context] as const,
  pages: (q: string) => [...searchKeys.all, 'pages', q] as const,
  suggestions: (prefix: string) =>
    [...searchKeys.all, 'suggestions', prefix] as const,
}

/**
 * Hook for the command palette search modal (Cmd+K).
 */
export function resolveSearchContext(
  query: string,
  defaultContext?: SearchContext,
): SearchContext | undefined {
  return parseSearchQuery(query).context ?? defaultContext
}

export function useSearchTasks(query: string, defaultContext?: SearchContext) {
  const debouncedQuery = useDebounce(query, 200)
  const context = resolveSearchContext(debouncedQuery, defaultContext)

  return useQuery({
    queryKey: searchKeys.results(debouncedQuery, context),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: {
          q: debouncedQuery,
          limit: '20',
          ...(context == null ? {} : { context }),
        },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: debouncedQuery.length > 0,
    placeholderData: (prev, prevQuery) => {
      const [, , , prevContext] = prevQuery?.queryKey ?? []
      return prevContext === context ? prev : undefined
    },
  })
}

export function useSearchPages(query: string) {
  const debouncedQuery = useDebounce(query, 200)

  return useQuery({
    queryKey: searchKeys.pages(debouncedQuery),
    queryFn: async () => {
      const res = await api.api.tasks.search.pages.$get({
        query: { q: debouncedQuery, limit: '20', source: 'page' },
      })
      return unwrapOrThrow(assertOk(res))
        .json()
        .then((body) => body.results)
    },
    enabled: debouncedQuery.length > 0,
  })
}

/**
 * Extract the token currently being typed (the last whitespace-delimited
 * word) so it can be used as the suggest API's `prefix`. Returns '' once
 * that word is already a complete `key:value` token, since there's nothing
 * left to suggest for it.
 */
export function extractCurrentPrefix(query: string): string {
  const parts = query.split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  if (last.includes(':') && !last.endsWith(':')) return ''
  return last
}

/**
 * Replace the token currently being typed (the last whitespace-delimited
 * word, i.e. what extractCurrentPrefix matched) with a chosen suggestion,
 * leaving a trailing space so the next word can start immediately.
 */
export function applySuggestionToQuery(
  query: string,
  suggestion: Suggestion,
): string {
  const parts = query.split(/\s+/)
  parts[parts.length - 1] = suggestion.value
  return parts.join(' ') + ' '
}

export function useSearchSuggestions(prefix: string) {
  const debouncedPrefix = useDebounce(prefix, 150)

  return useQuery({
    queryKey: searchKeys.suggestions(debouncedPrefix),
    queryFn: async () => {
      const res = await api.api.tasks.search.suggest.$get({
        query: { prefix: debouncedPrefix },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: debouncedPrefix.length > 0,
  })
}
