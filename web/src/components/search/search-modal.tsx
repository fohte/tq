import { parseSearchQuery } from 'api/search-query-parser'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { createCommandItems } from '#components/search/search-modal-command-items'
import { useSearchModalNavigation } from '#components/search/search-modal-navigation'
import {
  removeLastSearchScopeToken,
  useSearchModalQuery,
} from '#components/search/search-modal-query'
import { createRecentSearchItems } from '#components/search/search-modal-recent-item'
import {
  createOptionItem,
  createPageItems,
  createProjectItems,
  createViewItems,
  type ListItem,
  renderTaskOption,
} from '#components/search/search-modal-result-items'
import {
  indexResultGroups,
  type ResultGroup,
  SearchModalResultList,
} from '#components/search/search-modal-result-list'
import { Chip } from '#components/ui/chip'
import { KeybindHint } from '#components/ui/keybind-hint'
import { useCurrentContext } from '#hooks/use-current-context'
import { useDebounce } from '#hooks/use-debounce'
import { useProjects } from '#hooks/use-projects'
import { useSavedViews } from '#hooks/use-saved-views'
import {
  resolveSearchContext,
  type SearchResult,
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
  onNewTask?: () => void
}

export function SearchModal({
  open,
  onOpenChange,
  defaultContext: contextOverride,
  defaultQuery = '',
  onNewTask,
}: SearchModalProps) {
  const [query, setQuery] = useState(defaultQuery)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isContextCleared, setIsContextCleared] = useState(false)
  const [recentItems, setRecentItems] = useState<RecentSearchItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
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
  const { data: savedViews } = useSavedViews(searchFilter, {
    enabled: canSearchViews && searchFilter != null,
  })

  const { data: taskByNumber, isFetching: isFetchingTaskByNumber } =
    useSearchTaskByNumber(canSearchTasks ? searchQuery : '')
  const { data: pages, isFetching: isFetchingPages } = useSearchPages(
    canSearchPages ? searchQuery : '',
  )
  const isFetching =
    isFetchingTasks ||
    isFetchingTaskByNumber ||
    isFetchingPages ||
    isFetchingProjects
  const { data: suggestions } = useSearchSuggestions(currentPrefix)

  useEffect(() => {
    if (open) {
      setQuery(defaultQuery)
      setSelectedIndex(0)
      setIsContextCleared(false)
      setRecentItems(getRecentSearchItems())
    }
  }, [open, defaultQuery])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current == null) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (typeof selected?.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const resultGroups = useMemo((): ResultGroup[] => {
    const recentListItems =
      query === ''
        ? createRecentSearchItems(recentItems, openTask, openProject)
        : []
    const commandItems =
      searchMode === 'commands'
        ? createCommandItems(
            searchInputValue,
            openRoute,
            onNewTask == null
              ? undefined
              : () => {
                  onOpenChangeRef.current(false)
                  onNewTask()
                },
          )
        : []
    const suggestionItems: ListItem[] =
      suggestions && currentPrefix.length > 0
        ? suggestions.map((suggestion) => {
            const select = () => {
              applySuggestion(suggestion)
            }

            return createOptionItem(
              suggestion.value,
              select,
              <>
                <span className="font-mono text-sm text-foreground">
                  {suggestion.value}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {suggestion.display}
                </span>
              </>,
              { selectOnTab: select },
            )
          })
        : []
    const toTaskListItem = (task: SearchResult, keyPrefix = ''): ListItem => ({
      key: `${keyPrefix}${task.id}`,
      select: () => {
        openTask(task)
      },
      selectOnTab: () => {
        applyScope(`parent:${task.id}`)
      },
      render: renderTaskOption(task, onOpenChangeRef),
    })
    const taskItems: ListItem[] =
      canSearchTasks && hasSearchQuery
        ? (tasks
            ?.filter((task) => task.id !== taskByNumber?.id)
            .map((task) => toTaskListItem(task)) ?? [])
        : []
    const taskNumberItems: ListItem[] =
      canSearchTasks && hasSearchQuery && taskByNumber != null
        ? [toTaskListItem(taskByNumber, 'number:')]
        : []
    const pageItems =
      canSearchPages && hasSearchQuery
        ? createPageItems(pages, openPage, onOpenChangeRef)
        : []
    const projectItems =
      canSearchProjects && hasAuxiliarySearch
        ? createProjectItems(projects, openProject, (project) => {
            applyScope(`project:${project.id}`)
          })
        : []
    const viewItems =
      canSearchViews && hasAuxiliarySearch
        ? createViewItems(savedViews, openView)
        : []

    return [
      {
        id: 'commands',
        title: 'Commands',
        items: commandItems,
        isVisible: (_query, itemCount) => itemCount > 0,
      },
      {
        id: 'recent',
        title: 'Recently viewed',
        items: recentListItems,
        isVisible: (_query, itemCount) => itemCount > 0,
      },
      {
        id: 'task-number',
        title: 'Task number',
        items: taskNumberItems,
        isVisible: (_query, itemCount) => itemCount > 0,
      },
      {
        id: 'suggestions',
        title: 'Suggestions',
        items: canSuggest ? suggestionItems : [],
        isVisible: (_query, itemCount) => itemCount > 0,
      },
      {
        id: 'tasks',
        title: 'Tasks',
        items: taskItems,
        isVisible: (query, itemCount) => query.length > 0 && itemCount > 0,
      },
      {
        id: 'projects',
        title: 'Projects',
        items: projectItems,
        isVisible: (query, itemCount) => query.length > 0 && itemCount > 0,
      },
      {
        id: 'views',
        title: 'Views',
        items: viewItems,
        isVisible: (query, itemCount) => query.length > 0 && itemCount > 0,
      },
      {
        id: 'pages',
        title: 'Pages',
        items: pageItems,
        isVisible: (query, itemCount) => query.length > 0 && itemCount > 0,
      },
    ]
  }, [
    query,
    recentItems,
    searchMode,
    searchInputValue,
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
  ])

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
    searchQuery.length > 0 && !isFetching && visibleGroups.length === 0
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
          {/* Search input */}
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
            <span
              className="font-mono text-sm font-bold text-primary"
              data-testid="search-mode-indicator"
              aria-hidden="true"
            >
              {modePrefix ?? '>'}
            </span>
            {context != null && (
              <Chip size="md" active data-testid="search-context-scope">
                context:{context}
              </Chip>
            )}
            {searchScopeTokens.map((scopeToken, index) => (
              <Chip
                key={index}
                size="md"
                active
                data-testid="search-scope-token"
              >
                {scopeToken}
              </Chip>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={searchInputValue}
              onChange={(e) => {
                updateInputValue(e.target.value)
              }}
              placeholder={`Search ${searchTarget}...`}
              autoFocus
              className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
              aria-label={`Search ${searchTarget}`}
            />
            {isFetching && (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                data-testid="search-loading"
              />
            )}
            <KeybindHint variant="boxed">Esc</KeybindHint>
          </div>

          <SearchModalResultList
            groups={visibleGroups}
            listRef={listRef}
            selectedIndex={selectedIndex}
            onSelectedIndexChange={setSelectedIndex}
            {...(emptyMessage == null ? {} : { emptyMessage })}
            {...(initialMessage == null ? {} : { initialMessage })}
          />

          {/* Footer with keyboard hints */}
          <div className="flex min-h-9 flex-wrap items-center gap-1.5 border-t border-border px-4 py-2 font-mono text-2xs text-muted-foreground-ghost">
            <KeybindHint variant="boxed">↑↓</KeybindHint>
            <span>navigate</span>
            <KeybindHint variant="boxed">Tab</KeybindHint>
            <span>filter / autocomplete</span>
            <KeybindHint variant="boxed">Enter</KeybindHint>
            <span>open</span>
            <KeybindHint variant="boxed">Esc</KeybindHint>
            <span>close</span>
            {(canClearContext || canPopScope) && (
              <>
                <KeybindHint variant="boxed">Backspace</KeybindHint>
                <span>{canPopScope ? 'remove scope' : 'clear context'}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
