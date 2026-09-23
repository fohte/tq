import { useNavigate } from '@tanstack/react-router'
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

import {
  createOptionItem,
  createProjectItems,
  createViewItems,
  type ListItem,
} from '#components/search/search-modal-result-items'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Chip } from '#components/ui/chip'
import { KeybindHint } from '#components/ui/keybind-hint'
import { useCurrentContext } from '#hooks/use-current-context'
import { useDebounce } from '#hooks/use-debounce'
import type { Project } from '#hooks/use-projects'
import { useProjects } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import { useSavedViews } from '#hooks/use-saved-views'
import type { SearchResult, Suggestion } from '#hooks/use-search'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  resolveSearchContext,
  useSearchSuggestions,
  useSearchTasks,
} from '#hooks/use-search'
import { cn } from '#lib/utils'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultContext?: 'work' | 'personal' | null
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
}: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isContextCleared, setIsContextCleared] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const queryRef = useRef(query)
  const onOpenChangeRef = useRef(onOpenChange)
  queryRef.current = query
  onOpenChangeRef.current = onOpenChange
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const currentContext = useCurrentContext()
  const configuredContext =
    contextOverride === undefined
      ? currentContext
      : (contextOverride ?? undefined)
  const defaultSearchContext = isContextCleared ? undefined : configuredContext
  const context = resolveSearchContext(query, defaultSearchContext)
  const canClearContext = query === '' && context != null
  const freeTextQuery = parseSearchQuery(query).freeText
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

  const { data: tasks, isFetching } = useSearchTasks(
    query,
    defaultSearchContext,
  )
  const { data: projects } = useProjects(searchFilter, {
    enabled: searchFilter != null,
  })
  const { data: savedViews } = useSavedViews(searchFilter, {
    enabled: searchFilter != null,
  })

  const currentPrefix = extractCurrentPrefix(query)
  const { data: suggestions } = useSearchSuggestions(currentPrefix)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setIsContextCleared(false)
    }
  }, [open])

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

  const openTask = useCallback((task: SearchResult) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/tasks/$taskId',
      params: { taskId: task.id },
    })
  }, [])

  const openProject = useCallback((project: Project) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/projects/$projectId',
      params: { projectId: project.id },
    })
  }, [])

  const openView = useCallback((view: SavedView) => {
    onOpenChangeRef.current(false)
    void navigateRef.current({
      to: '/tasks',
      search: { q: view.query },
    })
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
    const taskItems: ListItem[] =
      tasks?.map((task) => ({
        key: task.id,
        select: () => {
          openTask(task)
        },
        render: ({ isSelected, onMouseMove }) => (
          <div
            role="option"
            aria-selected={isSelected}
            data-selected={isSelected}
            onMouseMove={onMouseMove}
            className={cn(isSelected ? 'bg-accent' : 'hover:bg-accent/50')}
          >
            <TaskRowAppearance
              task={task}
              onClick={(e) => {
                // Let the router's own modifier/middle-click handling
                // open a new tab without closing this one's search.
                if (
                  e.button !== 0 ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey
                ) {
                  return
                }
                onOpenChangeRef.current(false)
              }}
            />
          </div>
        ),
      })) ?? []
    const projectItems = hasAuxiliarySearch
      ? createProjectItems(projects, openProject)
      : []
    const viewItems = hasAuxiliarySearch
      ? createViewItems(savedViews, openView)
      : []

    return [
      {
        id: 'suggestions',
        title: 'Suggestions',
        items: suggestionItems,
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
    ]
  }, [
    suggestions,
    tasks,
    projects,
    savedViews,
    currentPrefix,
    applySuggestion,
    openTask,
    openProject,
    openView,
    hasAuxiliarySearch,
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
        if (canClearContext) {
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
            <span className="font-mono text-sm font-bold text-primary">
              &gt;
            </span>
            {context != null && (
              <Chip size="md" active data-testid="search-context-scope">
                context:{context}
              </Chip>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Search tasks..."
              autoFocus
              className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search tasks"
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
            {query.length > 0 && !isFetching && visibleGroups.length === 0 && (
              <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
                {`no results for "${query}"`}
              </div>
            )}

            {/* Initial state */}
            {query.length === 0 && (
              <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
                Type to search tasks
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
