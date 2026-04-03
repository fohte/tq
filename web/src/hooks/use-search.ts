import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertOk } from '@web/lib/assert-response'
import type { InferResponseType } from 'hono/client'
import { useEffect, useState } from 'react'

type SearchResult = InferResponseType<
  typeof api.api.tasks.search.$get,
  200
>[number]

type Suggestion = InferResponseType<
  (typeof api.api.tasks.search)['suggest']['$get'],
  200
>[number]

export type { SearchResult, Suggestion }

const searchKeys = {
  all: ['search'] as const,
  results: (q: string) => [...searchKeys.all, 'results', q] as const,
  suggestions: (prefix: string) =>
    [...searchKeys.all, 'suggestions', prefix] as const,
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debounced
}

export function useSearchTasks(query: string) {
  const debouncedQuery = useDebounce(query, 200)

  return useQuery({
    queryKey: searchKeys.results(debouncedQuery),
    queryFn: async () => {
      const res = await api.api.tasks.search.$get({
        query: { q: debouncedQuery, limit: '20' },
      })
      assertOk(res)
      return res.json()
    },
    enabled: debouncedQuery.length > 0,
    placeholderData: (prev) => prev,
  })
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
