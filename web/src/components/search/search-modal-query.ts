import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'
import { useCallback, useRef } from 'react'

import { parseSearchMode } from '#components/search/search-modal-mode'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  type Suggestion,
} from '#hooks/use-search'

const scopeTokenPattern =
  /(?:^|\s)((?:project|parent):(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+))/g

export function extractSearchScopeTokens(query: string): string[] {
  return Array.from(
    query.matchAll(scopeTokenPattern),
    (match) => match[1],
  ).filter((token): token is string => token != null)
}

export function stripSearchScopeTokens(query: string): string {
  return query.replace(scopeTokenPattern, ' ').trim()
}

export function removeLastSearchScopeToken(query: string): string {
  const lastMatch = Array.from(query.matchAll(scopeTokenPattern)).at(-1)
  const token = lastMatch?.[1]
  if (lastMatch?.index == null || token == null) return query

  const tokenStart = lastMatch.index + lastMatch[0].lastIndexOf(token)
  const before = query.slice(0, tokenStart)
  const after = query.slice(tokenStart + token.length)

  if (before.endsWith(' ')) return before.slice(0, -1) + after
  if (after.startsWith(' ')) return before + after.slice(1)
  return before + after
}

export function addSearchScope(query: string, scopeToken: string): string {
  const existingScopes = extractSearchScopeTokens(query)
  const filters = { ...parseSearchQuery(query), freeText: '' }
  delete filters.parentId
  delete filters.projectId
  const filterQuery = buildSearchQuery(filters)

  return [...existingScopes, filterQuery, scopeToken].filter(Boolean).join(' ')
}

export function useSearchModalQuery(
  query: string,
  setQuery: (query: string) => void,
  inputRef: { current: HTMLInputElement | null },
) {
  const queryRef = useRef(query)
  queryRef.current = query

  const {
    mode: searchMode,
    prefix: modePrefix,
    text: searchQuery,
  } = parseSearchMode(query)
  const searchScopeTokens = extractSearchScopeTokens(searchQuery)
  const queryWithoutScopes = stripSearchScopeTokens(searchQuery)
  const searchInputValue = queryWithoutScopes
  const currentPrefix = extractCurrentPrefix(
    searchMode == null ? queryWithoutScopes : '',
  )

  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      const { text } = parseSearchMode(queryRef.current)
      const scopeTokens = extractSearchScopeTokens(text)
      const suggestedQuery = applySuggestionToQuery(
        stripSearchScopeTokens(text),
        suggestion,
      )
      setQuery([...scopeTokens, suggestedQuery].filter(Boolean).join(' '))
      inputRef.current?.focus()
    },
    [inputRef, setQuery],
  )

  const applyScope = useCallback(
    (scopeToken: string) => {
      const { text } = parseSearchMode(queryRef.current)
      setQuery(addSearchScope(text, scopeToken))
      inputRef.current?.focus()
    },
    [inputRef, setQuery],
  )

  const updateInputValue = (value: string) => {
    setQuery(
      searchScopeTokens.length === 0
        ? modePrefix == null
          ? value
          : `${modePrefix}${value}`
        : `${modePrefix == null ? '' : `${modePrefix} `}${searchScopeTokens.join(' ')} ${value}`,
    )
  }

  return {
    searchMode,
    modePrefix,
    searchQuery,
    searchScopeTokens,
    searchInputValue,
    currentPrefix,
    applySuggestion,
    applyScope,
    updateInputValue,
  }
}
