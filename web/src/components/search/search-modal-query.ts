import {
  buildSearchQuery,
  parseSearchQuery,
  tokenizeSearchQuery,
} from 'api/search-query-parser'
import { useCallback, useRef } from 'react'

import { parseSearchMode } from '#components/search/search-modal-mode'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  type Suggestion,
} from '#hooks/use-search'

const scopeTokenPattern =
  /(?:^|\s)((?:project|parent|label):(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+))(?=\s)/g

export function extractSearchScopeTokens(query: string): string[] {
  return Array.from(
    query.matchAll(scopeTokenPattern),
    (match) => match[1],
  ).filter((token): token is string => token != null)
}

export function stripSearchScopeTokens(query: string): string {
  return query.replace(scopeTokenPattern, '').replace(/^\s+/, '')
}

export function removeLastSearchScopeToken(query: string): string {
  return removeSearchScopeToken(
    query,
    Array.from(query.matchAll(scopeTokenPattern)).length - 1,
  )
}

export function removeSearchScopeToken(query: string, index: number): string {
  const match = Array.from(query.matchAll(scopeTokenPattern))[index]
  const token = match?.[1]
  if (match?.index == null || token == null) return query

  const tokenStart = match.index + match[0].lastIndexOf(token)
  return removeQueryTokenAt(query, tokenStart, tokenStart + token.length)
}

export function removeSearchContextTokens(query: string): string {
  const ranges = tokenizeSearchQuery(query).filter(
    ({ start, end }) =>
      parseSearchQuery(query.slice(start, end)).context != null,
  )

  return ranges
    .reverse()
    .reduce(
      (result, { start, end }) => removeQueryTokenAt(result, start, end),
      query,
    )
}

function removeQueryTokenAt(query: string, start: number, end: number): string {
  const before = query.slice(0, start)
  const after = query.slice(end)

  if (/[ \t]$/.test(before)) return before.slice(0, -1) + after
  if (/^[ \t]/.test(after)) return before + after.slice(1)
  return before + after
}

export function addSearchScope(query: string, scopeToken: string): string {
  const existingScopes = extractSearchScopeTokens(query)
  const filters = { ...parseSearchQuery(query), freeText: '' }
  delete filters.parentId
  delete filters.projectId
  delete filters.label
  const filterQuery = buildSearchQuery(filters)

  return (
    [...existingScopes, filterQuery, scopeToken].filter(Boolean).join(' ') + ' '
  )
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
