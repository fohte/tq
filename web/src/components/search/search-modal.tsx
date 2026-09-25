import { parseSearchQuery } from 'api/search-query-parser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { SearchModalFooter } from '#components/search/search-modal-footer'
import { useSearchModalHelp } from '#components/search/search-modal-help'
import { SearchModalInput } from '#components/search/search-modal-input'
import { useSearchModalNavigation } from '#components/search/search-modal-navigation'
import {
  removeLastSearchScopeToken,
  useSearchModalQuery,
} from '#components/search/search-modal-query'
import { useSearchModalResultGroups } from '#components/search/search-modal-result-groups'
import {
  indexResultGroups,
  SearchModalResultList,
} from '#components/search/search-modal-result-list'
import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'
import { useCurrentContext } from '#hooks/use-current-context'
import { useDebounce } from '#hooks/use-debounce'
import { useProjects } from '#hooks/use-projects'
import { useSavedViews } from '#hooks/use-saved-views'
import {
  resolveSearchContext,
  useSearchPages,
  useSearchSuggestions,
  useSearchTaskByNumber,
  useSearchTasks,
} from '#hooks/use-search'
import {
  getRecentSearchItems,
  type RecentSearchItem,
} from '#lib/recent-search-items'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultContext?: 'work' | 'personal' | null
  defaultQuery?: string
  defaultHelpOpen?: boolean
  defaultRecentItems?: RecentSearchItem[]
  onNewTask?: () => void
}

export function SearchModal({
  open,
  onOpenChange,
  defaultContext: contextOverride,
  defaultQuery = '',
  defaultHelpOpen = false,
  defaultRecentItems,
  onNewTask,
}: SearchModalProps) {
  const [query, setQuery] = useState(defaultQuery)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isContextCleared, setIsContextCleared] = useState(false)
  const [recentItems, setRecentItems] = useState<RecentSearchItem[]>(
    defaultRecentItems ?? [],
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const helpBackButtonRef = useRef<HTMLButtonElement>(null)
  const {
    isHelpOpen,
    closeHelp,
    handleKeyDown: handleHelpKeyDown,
  } = useSearchModalHelp(open, inputRef, helpBackButtonRef, defaultHelpOpen)
  const listRef = useRef<HTMLDivElement>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange
  const {
    searchMode,
    modePrefix,
    searchQuery,
    searchScopeTokens,
    searchInputValue,
    currentPrefix,
    applySuggestion,
    applyScope,
    updateInputValue,
  } = useSearchModalQuery(query, setQuery, inputRef)
  const { openTask, openProject, openView, openPage, openRoute } =
    useSearchModalNavigation(onOpenChangeRef)
  const currentContext = useCurrentContext()
  const configuredContext =
    contextOverride === undefined
      ? currentContext
      : (contextOverride ?? undefined)
  const defaultSearchContext = isContextCleared ? undefined : configuredContext
  const hasSearchQuery = searchQuery.length > 0
  const context =
    searchMode === 'commands'
      ? undefined
      : resolveSearchContext(searchQuery, defaultSearchContext)
  const hasActiveScope =
    searchMode !== 'commands' &&
    (searchScopeTokens.length > 0 || context != null)
  const canPopScope = searchInputValue === '' && searchScopeTokens.length > 0
  const canClearContext =
    searchInputValue === '' && searchScopeTokens.length === 0 && context != null
  const freeTextQuery = parseSearchQuery(searchQuery).freeText
  const debouncedFreeTextQuery = useDebounce(freeTextQuery, 200)
  const debouncedContext = useDebounce(context, 200)
  const searchFilter =
    debouncedFreeTextQuery.length > 0
      ? {
          q: debouncedFreeTextQuery,
          ...(debouncedContext == null ? {} : { context: debouncedContext }),
        }
      : undefined
  const hasAuxiliarySearch = freeTextQuery.length > 0

  const canSearchTasks = searchMode == null || searchMode === 'tasks'
  const canSearchProjects = searchMode == null || searchMode === 'projects'
  const canSearchPages =
    (searchMode == null || searchMode === 'pages') &&
    parseSearchQuery(searchQuery).projectId == null
  const canSearchViews = searchMode == null
  const canSuggest = searchMode == null
  const { data: tasks, isFetching: isFetchingTasks } = useSearchTasks(
    canSearchTasks ? searchQuery : '',
    defaultSearchContext,
  )
  const { data: projects, isFetching: isFetchingProjects } = useProjects(
    searchFilter,
    {
      enabled: canSearchProjects && searchFilter != null,
    },
  )
  const { data: savedViews, isFetching: isFetchingSavedViews } = useSavedViews(
    searchFilter,
    {
      enabled: canSearchViews && searchFilter != null,
    },
  )

  const { data: taskByNumber, isFetching: isFetchingTaskByNumber } =
    useSearchTaskByNumber(canSearchTasks ? searchQuery : '')
  const { data: pages, isFetching: isFetchingPages } = useSearchPages(
    canSearchPages ? searchQuery : '',
  )
  const isFetching =
    isFetchingTasks ||
    isFetchingTaskByNumber ||
    isFetchingPages ||
    isFetchingProjects ||
    isFetchingSavedViews
  const { data: suggestions } = useSearchSuggestions(currentPrefix)

  const handleSearchEverywhere = useCallback(() => {
    const unscopedInputValue = searchInputValue
      .replace(/(^|\s)context:(?:work|personal)(?=\s|$)/gi, '$1')
      .replace(/\s+/g, ' ')
      .trim()
    setQuery(`${modePrefix ?? ''}${unscopedInputValue}`)
    setIsContextCleared(true)
    inputRef.current?.focus()
  }, [modePrefix, searchInputValue])

  useEffect(() => {
    if (open) {
      setQuery(defaultQuery)
      setSelectedIndex(0)
      setIsContextCleared(false)
      setRecentItems(defaultRecentItems ?? getRecentSearchItems())
    }
  }, [open, defaultQuery, defaultRecentItems])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current == null) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (typeof selected?.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const resultGroups = useSearchModalResultGroups({
    query,
    recentItems,
    searchMode,
    searchInputValue,
    context,
    onNewTask,
    openRoute,
    suggestions,
    tasks,
    taskByNumber,
    pages,
    projects,
    savedViews,
    currentPrefix,
    applySuggestion,
    applyScope,
    openTask,
    openProject,
    openView,
    openPage,
    hasAuxiliarySearch,
    canSearchTasks,
    canSearchProjects,
    canSearchPages,
    canSearchViews,
    canSuggest,
    hasSearchQuery,
    hasActiveScope,
    isFetching,
    onSearchEverywhere: handleSearchEverywhere,
    onOpenChangeRef,
  })

  const { items, indexedGroups } = useMemo(
    () => indexResultGroups(resultGroups),
    [resultGroups],
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  const handleSelect = useCallback(
    (index: number) => {
      const item = items[index]
      if (item == null) return
      item.select()
    },
    [items],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    if (handleHelpKeyDown(e, searchInputValue)) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        handleSelect(selectedIndex)
        break
      case 'Tab':
        e.preventDefault()
        items[selectedIndex]?.selectOnTab?.()
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
      case 'Backspace':
        if (searchMode != null && !hasSearchQuery) {
          e.preventDefault()
          setQuery('')
        } else if (canPopScope) {
          e.preventDefault()
          setQuery(
            `${modePrefix ?? ''}${removeLastSearchScopeToken(searchQuery)}`,
          )
        } else if (canClearContext) {
          e.preventDefault()
          setIsContextCleared(true)
        }
        break
    }
  }

  const visibleGroups = indexedGroups.filter((group) =>
    group.isVisible(searchQuery, group.items.length),
  )

  const emptyMessage =
    searchQuery.length > 0 &&
    !isFetching &&
    !indexedGroups.some(
      (group) =>
        group.id !== 'search-everywhere' &&
        group.isVisible(searchQuery, group.items.length),
    )
      ? searchInputValue.length === 0
        ? 'no results in this scope'
        : `no results for "${searchInputValue}"`
      : undefined
  const initialMessage =
    searchQuery.length === 0 && items.length === 0
      ? `Type to search ${searchMode ?? 'tasks'}`
      : undefined

  if (!open) return null

  const searchTarget = searchMode ?? 'tasks'

  return createPortal(
    <>
      {/* Backdrop + Modal wrapper (single layer to avoid z-index stacking issues) */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 modal-top-offset"
        data-testid="search-overlay"
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onOpenChange(false)
          }
        }}
      >
        <div
          className="flex max-h-120 w-full max-w-160 flex-col overflow-hidden border border-border bg-popover text-popover-foreground"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <SearchModalInput
            modePrefix={modePrefix}
            context={context}
            searchScopeTokens={searchScopeTokens}
            searchInputValue={searchInputValue}
            searchTarget={searchTarget}
            isFetching={isFetching}
            inputRef={inputRef}
            onInputValueChange={(value) => {
              closeHelp()
              updateInputValue(value)
            }}
          />

          {isHelpOpen ? (
            <SearchSyntaxHelpPanel
              sections={getSearchSyntaxHelpSections()}
              onBack={closeHelp}
              className="flex-1"
              backButtonRef={helpBackButtonRef}
            />
          ) : (
            <SearchModalResultList
              groups={visibleGroups}
              listRef={listRef}
              selectedIndex={selectedIndex}
              onSelectedIndexChange={setSelectedIndex}
              {...(emptyMessage == null ? {} : { emptyMessage })}
              {...(initialMessage == null ? {} : { initialMessage })}
            />
          )}

          <SearchModalFooter
            canClearContext={canClearContext}
            canPopScope={canPopScope}
            canOpenHelp={searchInputValue.length === 0}
            isHelpOpen={isHelpOpen}
          />
        </div>
      </div>
    </>,
    document.body,
  )
}
