import { parseSearchQuery } from 'api/search-query-parser'
import { Loader2 } from 'lucide-react'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { useSearchModalNavigation } from '#components/search/search-modal-navigation'
import {
  createOptionItem,
  createPageItems,
  createProjectItems,
  createViewItems,
  type ListItem,
  renderTaskOption,
} from '#components/search/search-modal-result-items'
import { Chip } from '#components/ui/chip'
import { KeybindHint } from '#components/ui/keybind-hint'
import { useCurrentContext } from '#hooks/use-current-context'
import { useDebounce } from '#hooks/use-debounce'
import { useProjects } from '#hooks/use-projects'
import { useSavedViews } from '#hooks/use-saved-views'
import type { SearchResult, Suggestion } from '#hooks/use-search'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
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

type SearchMode = 'tasks' | 'projects' | 'pages'

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
  const listRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const queryRef = useRef(query)
  const onOpenChangeRef = useRef(onOpenChange)
  queryRef.current = query
  onOpenChangeRef.current = onOpenChange
  const { openTask, openProject, openView, openPage } =
    useSearchModalNavigation(onOpenChangeRef)
  const currentContext = useCurrentContext()
  const configuredContext =
    contextOverride === undefined
      ? currentContext
      : (contextOverride ?? undefined)
  const defaultSearchContext = isContextCleared ? undefined : configuredContext
  const searchMode: SearchMode | undefined = query.startsWith('#')
    ? 'tasks'
    : query.startsWith('!')
      ? 'projects'
      : query.startsWith('/')
        ? 'pages'
        : undefined
  const modePrefix = searchMode == null ? undefined : query[0]
  const searchQuery = searchMode == null ? query : query.slice(1).trimStart()
  const context = resolveSearchContext(searchQuery, defaultSearchContext)
  const canClearContext = query === '' && context != null
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
  const canSearchPages = searchMode == null || searchMode === 'pages'
  const { data: tasks, isFetching: isFetchingTasks } = useSearchTasks(
    canSearchTasks ? searchQuery : '',
    defaultSearchContext,
  )
  const { data: projects, isFetching: isFetchingProjects } = useProjects(
    canSearchProjects ? searchFilter : undefined,
    {
      enabled: canSearchProjects && searchFilter != null,
    },
  )
  const { data: savedViews } = useSavedViews(
    searchMode == null ? searchFilter : undefined,
    {
      enabled: searchMode == null && searchFilter != null,
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
    isFetchingProjects
  const currentPrefix = extractCurrentPrefix(
    searchMode == null ? searchQuery : '',
  )
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

  const applySuggestion = useCallback((suggestion: Suggestion) => {
    setQuery(applySuggestionToQuery(queryRef.current, suggestion))
    inputRef.current?.focus()
  }, [])

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
      render: renderTaskOption(task, onOpenChangeRef),
    })
    const taskItems: ListItem[] = canSearchTasks
      ? (tasks
          ?.filter((task) => task.id !== taskByNumber?.id)
          .map((task) => toTaskListItem(task)) ?? [])
      : []
    const taskNumberItems: ListItem[] =
      canSearchTasks && taskByNumber != null
        ? [toTaskListItem(taskByNumber, 'number:')]
        : []
    const pageItems = canSearchPages
      ? createPageItems(pages, openPage, onOpenChangeRef)
      : []
    const projectItems =
      canSearchProjects && hasAuxiliarySearch
        ? createProjectItems(projects, openProject)
        : []
    const viewItems =
      searchMode == null && hasAuxiliarySearch
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
        items: searchMode == null ? suggestionItems : [],
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
    openTask,
    openProject,
    openView,
    openPage,
    hasAuxiliarySearch,
    canSearchTasks,
    canSearchProjects,
    canSearchPages,
    searchMode,
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
        if (modePrefix != null && query === modePrefix) {
          e.preventDefault()
          setQuery('')
        } else if (canClearContext) {
          e.preventDefault()
          setIsContextCleared(true)
        }
        break
    }
  }

  const visibleGroups = indexedGroups.filter((group) =>
    group.isVisible(query, group.items.length),
  )

  if (!open) return null

  const searchTarget = searchMode ?? 'tasks'
  const inputValue = searchMode == null ? query : searchQuery

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
          <div className="flex h-12 items-center gap-3 border-b border-border px-4">
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
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setQuery(
                  modePrefix == null
                    ? e.target.value
                    : `${modePrefix}${e.target.value}`,
                )
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

          {/* Results list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-2"
            role="listbox"
            aria-label="Search results"
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
                  {`no results for "${searchQuery}"`}
                </div>
              )}

            {/* Initial state */}
            {searchQuery.length === 0 && (
              <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
                {`Type to search ${searchTarget}`}
              </div>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex min-h-9 flex-wrap items-center gap-1.5 border-t border-border px-4 py-2 font-mono text-2xs text-muted-foreground-ghost">
            <KeybindHint variant="boxed">↑↓</KeybindHint>
            <span>navigate</span>
            <KeybindHint variant="boxed">Tab</KeybindHint>
            <span>autocomplete</span>
            <KeybindHint variant="boxed">Enter</KeybindHint>
            <span>open</span>
            <KeybindHint variant="boxed">Esc</KeybindHint>
            <span>close</span>
            {canClearContext && (
              <>
                <KeybindHint variant="boxed">Backspace</KeybindHint>
                <span>clear context</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
