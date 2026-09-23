import { useQuery } from '@tanstack/react-query'
import { parseSearchQuery } from 'api/search-query-parser'
import type { InferResponseType } from 'hono/client'

import { useDebounce } from '#hooks/use-debounce'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

type SearchResult = InferResponseType<typeof api.api.tasks.$get, 200>[number]

type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

type Suggestion = InferResponseType<
  (typeof api.api.tasks.search)['suggest']['$get'],
  200
>[number]
type SearchContext = 'work' | 'personal'

export type { SearchResult, Suggestion }

export const searchKeys = {
  all: ['search'] as const,
  results: (q: string, context: SearchContext | undefined) =>
    [...searchKeys.all, 'results', q, context] as const,
  number: (number: string | undefined) =>
    [...searchKeys.all, 'number', number] as const,
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

export function extractTaskNumber(query: string): string | undefined {
  return /^#?(\d+)$/.exec(query)?.[1]
}

export function taskDetailToSearchResult(task: TaskDetail): SearchResult {
  return {
    ...task,
    duplicateOfNumber: task.duplicateOfNumber ?? null,
    blockedByNumbers: task.blockedBy.map(({ number }) => number),
  }
}

export function useSearchTaskByNumber(query: string) {
  const debouncedQuery = useDebounce(query, 200)
  const taskNumber = extractTaskNumber(debouncedQuery)

  return useQuery({
    queryKey: searchKeys.number(taskNumber),
    queryFn: async () => {
      if (taskNumber == null) return null

      const res = await api.api.tasks[':id'].$get({
        param: { id: taskNumber },
      })
      if (!res.ok) return null

      return taskDetailToSearchResult(await res.json())
    },
    enabled: taskNumber != null,
    retry: false,
    throwOnError: (error) => {
      console.error('Failed to load task by number', error)
      return false
    },
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
