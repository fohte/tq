import { useQuery } from '@tanstack/react-query'
import { parseSearchQuery } from 'api/search-query-parser'
import type { InferResponseType } from 'hono/client'

import { useDebounce } from '#hooks/use-debounce'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'
import type { SearchContext } from '#lib/query-keys'
import { searchKeys } from '#lib/query-keys'
import {
  extractTaskNumber,
  filterSearchSuggestions,
  taskDetailToSearchResult,
} from '#lib/search-utils'

type SearchResult = Omit<
  InferResponseType<typeof api.api.tasks.$get, 200>[number],
  'estimatedMinutes'
>

type Suggestion = InferResponseType<
  (typeof api.api.tasks.search)['suggest']['$get'],
  200
>[number]
type PageSearchResult = InferResponseType<
  (typeof api.api.tasks.search)['pages']['$get'],
  200
>['results'][number]
export const SEARCH_QUERY_DEBOUNCE_MS = 200

export type { PageSearchResult, SearchResult, Suggestion }

/**
 * Hook for the command palette search modal (Cmd+K).
 */
export function resolveSearchContext(
  query: string,
  defaultContext?: SearchContext,
): SearchContext | undefined {
  return parseSearchQuery(query).context ?? defaultContext
}

function useDebouncedSearchQuery(query: string) {
  return useDebounce(query, SEARCH_QUERY_DEBOUNCE_MS)
}

export function useSearchTasks(query: string, defaultContext?: SearchContext) {
  const debouncedQuery = useDebouncedSearchQuery(query)
  const context = resolveSearchContext(debouncedQuery, defaultContext)
  const hasFreeText = parseSearchQuery(debouncedQuery).freeText.length > 0

  const queryResult = useQuery({
    queryKey: searchKeys.results(debouncedQuery, context),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: {
          q: debouncedQuery,
          limit: '20',
          context: context ?? 'all',
          status: 'all',
          ...(hasFreeText ? { includeMatch: 'true' } : {}),
        },
      })
      return unwrapOrThrow(assertOk(res))
        .json()
        .then((results): SearchResult[] => results)
    },
    enabled: debouncedQuery.length > 0,
    placeholderData: (prev, prevQuery) => {
      const [, , , prevContext] = prevQuery?.queryKey ?? []
      return prevContext === context ? prev : undefined
    },
  })

  return { ...queryResult, isDebouncing: debouncedQuery !== query }
}

export function useSearchTaskByNumber(query: string) {
  const debouncedQuery = useDebouncedSearchQuery(query)
  const taskNumber = extractTaskNumber(debouncedQuery)

  const queryResult = useQuery({
    queryKey: searchKeys.number(taskNumber),
    queryFn: async () => {
      if (taskNumber == null) return null

      const res = await api.api.tasks[':id'].$get({
        param: { id: taskNumber },
      })
      if (res.status === 404) return null

      return taskDetailToSearchResult(await unwrapOrThrow(assertOk(res)).json())
    },
    enabled: taskNumber != null,
    retry: false,
    throwOnError: (error) => {
      console.error('Failed to load task by number', error)
      return false
    },
  })

  return { ...queryResult, isDebouncing: debouncedQuery !== query }
}

export function useSearchPages(query: string) {
  const debouncedQuery = useDebounce(query, SEARCH_QUERY_DEBOUNCE_MS)

  const queryResult = useQuery({
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

  return { ...queryResult, isDebouncing: debouncedQuery !== query }
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
      return unwrapOrThrow(assertOk(res)).json().then(filterSearchSuggestions)
    },
    enabled: debouncedPrefix.length > 0,
  })
}
