import { parseSearchQuery } from 'api/search-query-parser'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { SearchModalFooter } from '#components/search/search-modal-footer'
import { useSearchModalHelp } from '#components/search/search-modal-help'
import { SearchModalInput } from '#components/search/search-modal-input'
import { useSearchModalNavigation } from '#components/search/search-modal-navigation'
import {
  removeLastSearchScopeToken,
  useSearchModalQuery,
} from '#components/search/search-modal-query'
import {
  createOptionItem,
  createPageItems,
  createProjectItems,
  createViewItems,
  type ListItem,
  renderTaskOption,
} from '#components/search/search-modal-result-items'
import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'
import { useCurrentContext } from '#hooks/use-current-context'
import { useDebounce } from '#hooks/use-debounce'
import { useProjects } from '#hooks/use-projects'
import { useSavedViews } from '#hooks/use-saved-views'
import type { SearchResult } from '#hooks/use-search'
import {
  resolveSearchContext,
  useSearchPages,
  useSearchSuggestions,
  useSearchTaskByNumber,
  useSearchTasks,
} from '#hooks/use-search'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultContext?: 'work' | 'personal' | null
  defaultQuery?: string
}

interface ResultGroup {
  id: string
  title: string
  items: ListItem[]
  isVisible: (query: string, itemCount: number) => boolean
}

interface IndexedResultGroup extends Omit<ResultGroup, 'items'> {
  items: { item: ListItem; globalIndex: number }[]
}

export function SearchModal({
  open,
  onOpenChange,
  defaultContext: contextOverride,
  defaultQuery = '',
}: SearchModalProps) {
  const [query, setQuery] = useState(defaultQuery)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isContextCleared, setIsContextCleared] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    isHelpOpen,
    closeHelp,
    handleKeyDown: handleHelpKeyDown,
  } = useSearchModalHelp(open, inputRef)
  const listRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })
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
  const { openTask, openProject, openView, openPage } =
    useSearchModalNavigation(onOpenChangeRef)
  const currentContext = useCurrentContext()
  const configuredContext =
    contextOverride === undefined
      ? currentContext
      : (contextOverride ?? undefined)
  const defaultSearchContext = isContextCleared ? undefined : configuredContext
  const hasSearchQuery = searchQuery.length > 0
  const context = resolveSearchContext(searchQuery, defaultSearchContext)
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

  const { items, indexedGroups } = useMemo((): {
    items: ListItem[]
    indexedGroups: IndexedResultGroup[]
  } => {
    let globalIndex = 0
    const indexedGroups = resultGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        item,
        globalIndex: globalIndex++,
      })),
    }))

    return {
      indexedGroups,
      items: indexedGroups.flatMap((group) =>
        group.items.map(({ item }) => item),
      ),
    }
  }, [resultGroups])

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

          {/* Results list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-2"
            role="listbox"
            aria-label="Search results"
            hidden={isHelpOpen}
          >
            {visibleGroups.map((group, groupIndex) => (
              <Fragment key={group.id}>
                {groupIndex > 0 && <div className="mx-4 my-1 h-px bg-border" />}
                <div className="px-4 py-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
                  {group.title}
                </div>
                {group.items.map(({ item, globalIndex }) => (
                  <Fragment key={item.key}>
                    {item.render({
                      isSelected: selectedIndex === globalIndex,
                      onMouseMove: (e) => {
                        if (
                          e.clientX !== lastMousePos.current.x ||
                          e.clientY !== lastMousePos.current.y
                        ) {
                          lastMousePos.current = {
                            x: e.clientX,
                            y: e.clientY,
                          }
                          setSelectedIndex(globalIndex)
                        }
                      },
                    })}
                  </Fragment>
                ))}
              </Fragment>
            ))}

            {/* Empty state */}
            {searchQuery.length > 0 &&
              !isFetching &&
              visibleGroups.length === 0 && (
                <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
                  {searchInputValue.length === 0
                    ? 'no results in this scope'
                    : `no results for "${searchInputValue}"`}
                </div>
              )}

            {/* Initial state */}
            {searchQuery.length === 0 && (
              <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
                {`Type to search ${searchTarget}`}
              </div>
            )}
          </div>
          {isHelpOpen && (
            <SearchSyntaxHelpPanel
              sections={getSearchSyntaxHelpSections()}
              onBack={closeHelp}
              className="flex-1"
            />
          )}

          <SearchModalFooter
            canClearContext={canClearContext}
            canPopScope={canPopScope}
            isHelpOpen={isHelpOpen}
          />
        </div>
      </div>
    </>,
    document.body,
  )
}
