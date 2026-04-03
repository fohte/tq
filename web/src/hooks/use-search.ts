import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertOk } from '@web/lib/assert-response'
import type { InferResponseType } from 'hono/client'
import { useCallback, useMemo, useState } from 'react'

type SearchResult = InferResponseType<
  typeof api.api.tasks.search.$get,
  200
>[number]

export type { SearchResult }

export type StatusFilter = 'todo' | 'in_progress' | 'completed'
export type ContextFilter = 'work' | 'personal' | 'dev'

export interface SearchFilters {
  status?: StatusFilter | undefined
  context?: ContextFilter | undefined
  label?: string | undefined
  sortBy?: 'due' | 'created' | 'updated' | 'estimate' | undefined
}

const STATUS_VALUES: ReadonlySet<StatusFilter> = new Set([
  'todo',
  'in_progress',
  'completed',
])
const CONTEXT_VALUES: ReadonlySet<ContextFilter> = new Set([
  'work',
  'personal',
  'dev',
])
type SortBy = NonNullable<SearchFilters['sortBy']>
const SORT_VALUES: ReadonlySet<SortBy> = new Set([
  'due',
  'created',
  'updated',
  'estimate',
])

function isStatus(value: string): value is StatusFilter {
  return (STATUS_VALUES as ReadonlySet<string>).has(value)
}

function isContext(value: string): value is ContextFilter {
  return (CONTEXT_VALUES as ReadonlySet<string>).has(value)
}

function isSortBy(value: string): value is SortBy {
  return (SORT_VALUES as ReadonlySet<string>).has(value)
}

/**
 * Parse a query string into free text and structured filters.
 * Mirrors the API's search-query-parser logic on the frontend.
 */
export function parseQueryToFilters(query: string): {
  freeText: string
  filters: SearchFilters
} {
  const filters: SearchFilters = {}
  const freeTextParts: string[] = []

  const tokens = query.split(/\s+/).filter((t) => t !== '')

  for (const token of tokens) {
    const colonIndex = token.indexOf(':')
    if (colonIndex === -1) {
      freeTextParts.push(token)
      continue
    }

    const prefix = token.slice(0, colonIndex).toLowerCase()
    const value = token.slice(colonIndex + 1)

    if (value === '') {
      freeTextParts.push(token)
      continue
    }

    switch (prefix) {
      case 'is':
        if (isStatus(value)) {
          filters.status = value
        } else {
          freeTextParts.push(token)
        }
        break
      case 'context':
        if (isContext(value)) {
          filters.context = value
        } else {
          freeTextParts.push(token)
        }
        break
      case 'label':
        filters.label = value
        break
      case 'sort':
        if (isSortBy(value)) {
          filters.sortBy = value
        } else {
          freeTextParts.push(token)
        }
        break
      default:
        freeTextParts.push(token)
    }
  }

  return { freeText: freeTextParts.join(' '), filters }
}

/**
 * Build a query string from free text and structured filters.
 */
export function buildQueryFromFilters(
  freeText: string,
  filters: SearchFilters,
): string {
  const parts: string[] = []

  if (filters.status != null) parts.push(`is:${filters.status}`)
  if (filters.context != null) parts.push(`context:${filters.context}`)
  if (filters.label != null) parts.push(`label:${filters.label}`)
  if (filters.sortBy != null) parts.push(`sort:${filters.sortBy}`)

  const trimmed = freeText.trim()
  if (trimmed !== '') parts.push(trimmed)

  return parts.join(' ')
}

const searchKeys = {
  all: ['search'] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
}

export function useSearch() {
  const [query, setQuery] = useState('')

  const { freeText, filters } = useMemo(
    () => parseQueryToFilters(query),
    [query],
  )

  const hasQuery = query.trim() !== ''

  const searchQuery = useQuery({
    queryKey: searchKeys.query(query),
    queryFn: async () => {
      const res = await api.api.tasks.search.$get({
        query: { q: query, limit: '20' },
      })
      assertOk(res)
      return res.json()
    },
    enabled: hasQuery,
    placeholderData: (prev) => prev,
  })

  const updateFilter = useCallback(
    (key: keyof SearchFilters, value: string | undefined) => {
      const { freeText: currentFreeText, filters: currentFilters } =
        parseQueryToFilters(query)
      if (value == null) {
        const newFilters: SearchFilters = { ...currentFilters }
        newFilters[key] = undefined
        setQuery(buildQueryFromFilters(currentFreeText, newFilters))
        return
      }
      const newFilters: SearchFilters = {
        ...currentFilters,
        [key]: value,
      }
      setQuery(buildQueryFromFilters(currentFreeText, newFilters))
    },
    [query],
  )

  const clearFilter = useCallback(
    (key: keyof SearchFilters) => {
      updateFilter(key, undefined)
    },
    [updateFilter],
  )

  return {
    query,
    setQuery,
    freeText,
    filters,
    results: searchQuery.data ?? [],
    isLoading: searchQuery.isLoading,
    isFetching: searchQuery.isFetching,
    hasQuery,
    updateFilter,
    clearFilter,
  }
}
