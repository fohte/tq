import { useQuery } from '@tanstack/react-query'
import type { ParsedQuery } from 'api/search-query-parser'
import {
  buildSearchQuery,
  CONTEXT_VALUES,
  isOneOf,
  parseSearchQuery,
  SORT_VALUES,
  STATUS_VALUES,
} from 'api/search-query-parser'
import type { InferResponseType } from 'hono/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useDebounce } from '#hooks/use-debounce'
import { api } from '#lib/api'
import { assertOk } from '#lib/assert-response'

type SearchResult = InferResponseType<typeof api.api.tasks.$get, 200>[number]

type Suggestion = InferResponseType<
  (typeof api.api.tasks.search)['suggest']['$get'],
  200
>[number]

export type { SearchResult, Suggestion }

export type SearchFilterKey = 'status' | 'context' | 'sortBy'

/**
 * Toggle a filter value within a parsed query: `status` accumulates (a
 * search can have multiple `is:` tokens), `context`/`sortBy` are exclusive
 * (clicking the already-active value clears it, clicking another replaces
 * it). Values that aren't valid for the given key are ignored — FilterChip
 * only ever offers values from its own option list, so this only guards
 * against them widening to `string` for the no-unsafe-type-assertion rule.
 */
export function toggleSearchFilter(
  parsed: ParsedQuery,
  key: SearchFilterKey,
  value: string,
): ParsedQuery {
  const next: ParsedQuery = { ...parsed }

  if (key === 'status' && isOneOf(value, STATUS_VALUES)) {
    const status = parsed.status ?? []
    const nextStatus = status.includes(value)
      ? status.filter((s) => s !== value)
      : [...status, value]
    if (nextStatus.length > 0) {
      next.status = nextStatus
    } else {
      delete next.status
    }
  } else if (key === 'context' && isOneOf(value, CONTEXT_VALUES)) {
    if (parsed.context === value) {
      delete next.context
    } else {
      next.context = value
    }
  } else if (key === 'sortBy' && isOneOf(value, SORT_VALUES)) {
    if (parsed.sortBy === value) {
      delete next.sortBy
    } else {
      next.sortBy = value
    }
  }

  return next
}

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
  results: (q: string) => [...searchKeys.all, 'results', q] as const,
  suggestions: (prefix: string) =>
    [...searchKeys.all, 'suggestions', prefix] as const,
}

/**
 * Hook for the SP full-screen search view.
 */
export function useSearch() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => {
      clearTimeout(handler)
    }
  }, [query])

  const parsed = useMemo(() => parseSearchQuery(query), [query])
  const { freeText, ...filters } = parsed

  const hasQuery = query.trim() !== ''
  const isDebouncing = query !== debouncedQuery

  const searchQuery = useQuery({
    queryKey: searchKeys.query(debouncedQuery),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: { q: debouncedQuery, limit: '20' },
      })
      assertOk(res)
      return res.json()
    },
    enabled: debouncedQuery.trim() !== '',
    placeholderData: (prev) => prev,
  })

  const updateFilter = useCallback(
    (key: SearchFilterKey, value: string) => {
      setQuery(buildSearchQuery(toggleSearchFilter(parsed, key, value)))
    },
    [parsed],
  )

  return {
    query,
    setQuery,
    freeText,
    filters,
    results: searchQuery.data ?? [],
    isLoading: searchQuery.isLoading,
    isFetching: searchQuery.isFetching || isDebouncing,
    hasQuery,
    updateFilter,
  }
}

/**
 * Hook for the command palette search modal (Cmd+K).
 */
export function useSearchTasks(query: string) {
  const debouncedQuery = useDebounce(query, 200)

  return useQuery({
    queryKey: searchKeys.results(debouncedQuery),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: { q: debouncedQuery, limit: '20' },
      })
      assertOk(res)
      return res.json()
    },
    enabled: debouncedQuery.length > 0,
    placeholderData: (prev) => prev,
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
      assertOk(res)
      return res.json()
    },
    enabled: debouncedPrefix.length > 0,
  })
}
