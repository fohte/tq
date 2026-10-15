import { CommandPalette } from '@fohte/ui/command-palette'
import { parseSearchQuery } from 'api/search-query-parser'
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { SearchModalFooter } from '#components/search/search-modal-footer'
import { useSearchModalHelp } from '#components/search/search-modal-help'
import { SearchModalInputAdornment } from '#components/search/search-modal-input-adornment'
import { SearchModalModeSwitcher } from '#components/search/search-modal-mode-switcher'
import { useSearchModalNavigation } from '#components/search/search-modal-navigation'
import {
  removeLastSearchScopeToken,
  removeSearchContextTokens,
  removeSearchScopeToken,
  useSearchModalQuery,
} from '#components/search/search-modal-query'
import {
  resultGroupItemCount,
  useSearchModalResultGroups,
} from '#components/search/search-modal-result-groups'
import { useSearchModalTaskActions } from '#components/search/search-modal-task-actions'
import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPanel } from '#components/search/search-syntax-help-panel'
import { useCurrentContext } from '#hooks/use-current-context'
import { useCurrentRoute } from '#hooks/use-current-route'
import { useDebounce } from '#hooks/use-debounce'
import {
  type ProjectFilter,
  useProject,
  useProjects,
} from '#hooks/use-projects'
import { useSavedViews } from '#hooks/use-saved-views'
import {
  resolveSearchContext,
  SEARCH_QUERY_DEBOUNCE_MS,
  useSearchPages,
  useSearchSuggestions,
  useSearchTaskByNumber,
  useSearchTasks,
} from '#hooks/use-search'
import { useSearchScopeLabels } from '#hooks/use-search-scope-labels'
import { useTask } from '#hooks/use-tasks'
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
  const defaultQueryRef = useRef(defaultQuery)
  defaultQueryRef.current = defaultQuery
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
  const { completeTask, copyTaskUrl } =
    useSearchModalTaskActions(onOpenChangeRef)
  const currentContext = useCurrentContext()
  const currentRoute = useCurrentRoute()
  const currentTaskId =
    currentRoute.kind === 'task-detail' ? currentRoute.taskId : ''
  const { data: currentTask } = useTask(currentTaskId, {
    enabled: open && currentRoute.kind === 'task-detail',
  })
  const parentTaskId = currentTask?.parentId ?? ''
  const { data: parentTaskDetail } = useTask(parentTaskId, {
    enabled: open && parentTaskId !== '',
  })
  const parentTask =
    parentTaskDetail?.id === currentTask?.parentId
      ? parentTaskDetail
      : undefined
  const currentProjectId = currentTask?.projectId ?? ''
  const { data: taskProjectDetail } = useProject(currentProjectId, {
    enabled: open && currentProjectId !== '',
  })
  const currentProject =
    taskProjectDetail?.id === currentTask?.projectId
      ? taskProjectDetail
      : undefined
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
  const parsedSearchQuery = parseSearchQuery(searchQuery)
  const hasTaskSearchScope = searchMode == null || searchMode === 'tasks'
  const hasActiveScope =
    (hasTaskSearchScope && (searchScopeTokens.length > 0 || context != null)) ||
    (searchMode === 'projects' && context != null) ||
    (searchMode === 'pages' && parsedSearchQuery.projectId != null)
  const canPopScope = searchInputValue === '' && searchScopeTokens.length > 0
  const canClearContext =
    searchInputValue === '' && searchScopeTokens.length === 0 && context != null
  const freeTextQuery = parsedSearchQuery.freeText
  const debouncedFreeTextQuery = useDebounce(
    freeTextQuery,
    SEARCH_QUERY_DEBOUNCE_MS,
  )
  const debouncedContext = useDebounce(context, SEARCH_QUERY_DEBOUNCE_MS)
  const hasDebouncedFreeTextQuery = debouncedFreeTextQuery.length > 0
  const projectFilter: ProjectFilter = {
    q: debouncedFreeTextQuery,
    context:
      debouncedContext === 'work' || debouncedContext === 'personal'
        ? debouncedContext
        : 'all',
    status: 'all' as const,
  }
  const savedViewFilter = hasDebouncedFreeTextQuery
    ? {
        q: debouncedFreeTextQuery,
        ...(debouncedContext == null ? {} : { context: debouncedContext }),
      }
    : undefined
  const hasAuxiliarySearch = freeTextQuery.length > 0
  const searchScopeLabels = useSearchScopeLabels(searchScopeTokens, open)

  const clearContext = useCallback(
    (value: string) => {
      setQuery(`${modePrefix ?? ''}${removeSearchContextTokens(value)}`)
      setIsContextCleared(true)
      inputRef.current?.focus()
    },
    [modePrefix],
  )

  const handleRemoveContext = useCallback(() => {
    clearContext(searchQuery)
  }, [clearContext, searchQuery])

  const handleRemoveScopeToken = (index: number) => {
    setQuery(`${modePrefix ?? ''}${removeSearchScopeToken(searchQuery, index)}`)
    inputRef.current?.focus()
  }

  const canSearchTasks = searchMode == null || searchMode === 'tasks'
  const canSearchProjects = searchMode == null || searchMode === 'projects'
  const canSearchPages =
    (searchMode == null || searchMode === 'pages') &&
    parsedSearchQuery.projectId == null
  const canSearchViews = searchMode == null
  const canSuggest = searchMode == null
  const {
    data: tasks,
    isFetching: isFetchingTasks,
    isDebouncing: isDebouncingTasks,
  } = useSearchTasks(canSearchTasks ? searchQuery : '', defaultSearchContext)
  const { data: projects, isFetching: isFetchingProjects } = useProjects(
    projectFilter,
    {
      enabled: canSearchProjects && hasDebouncedFreeTextQuery,
    },
  )
  const { data: savedViews, isFetching: isFetchingSavedViews } = useSavedViews(
    savedViewFilter,
    {
      enabled: canSearchViews && savedViewFilter != null,
    },
  )

  const {
    data: taskByNumber,
    isFetching: isFetchingTaskByNumber,
    isDebouncing: isDebouncingTaskByNumber,
  } = useSearchTaskByNumber(canSearchTasks ? searchQuery : '')
  const {
    data: pages,
    isFetching: isFetchingPages,
    isDebouncing: isDebouncingPages,
  } = useSearchPages(canSearchPages ? searchQuery : '')
  const isFetching =
    isFetchingTasks ||
    isFetchingTaskByNumber ||
    isFetchingPages ||
    isFetchingProjects ||
    isFetchingSavedViews
  const isSearchPending =
    isFetching ||
    isDebouncingTasks ||
    isDebouncingTaskByNumber ||
    isDebouncingPages ||
    debouncedFreeTextQuery !== freeTextQuery ||
    debouncedContext !== context
  const { data: suggestions } = useSearchSuggestions(currentPrefix)

  const handleSearchEverywhere = useCallback(() => {
    clearContext(searchInputValue)
  }, [clearContext, searchInputValue])

  useEffect(() => {
    if (open) {
      setQuery(defaultQueryRef.current)
      setIsContextCleared(false)
      setRecentItems(defaultRecentItems ?? getRecentSearchItems())
    }
  }, [open, defaultRecentItems])

  const { resultGroups, hasVisibleResults } = useSearchModalResultGroups({
    query,
    recentItems,
    searchMode,
    searchInputValue,
    context,
    currentTask,
    parentTask,
    currentProject,
    onNewTask,
    openRoute,
    completeTask,
    copyTaskUrl,
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
    freeTextQuery,
    hasExplicitSort: parsedSearchQuery.sortBy != null,
    hasActiveScope,
    isSearchPending,
    onSearchEverywhere: handleSearchEverywhere,
    onOpenChangeRef,
  })

  const handleModeChange = (prefix: string | undefined) => {
    setQuery(`${prefix ?? ''}${searchQuery}`)
    inputRef.current?.focus()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (handleHelpKeyDown(event, searchInputValue)) return

    if (event.key === 'Backspace') {
      if (searchMode != null && !hasSearchQuery) {
        event.preventDefault()
        setQuery('')
      } else if (canPopScope) {
        event.preventDefault()
        setQuery(
          `${modePrefix ?? ''}${removeLastSearchScopeToken(searchQuery)}`,
        )
      } else if (canClearContext) {
        event.preventDefault()
        setIsContextCleared(true)
      }
    }
  }

  const handleHelpPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    handleHelpKeyDown(event, searchInputValue)
    if (event.key === 'Escape') event.stopPropagation()
  }

  const visibleGroups = resultGroups.filter((group) =>
    group.isVisible(searchQuery, resultGroupItemCount(group)),
  )
  const visibleItemCount = visibleGroups.reduce(
    (count, group) => count + resultGroupItemCount(group),
    0,
  )

  const emptyMessage =
    searchQuery.length > 0 && !isSearchPending && !hasVisibleResults
      ? searchInputValue.length === 0
        ? 'no results in this scope'
        : `no results for "${searchInputValue}"`
      : undefined
  const initialMessage =
    searchQuery.length === 0 && visibleItemCount === 0
      ? `Type to search ${searchMode ?? 'tasks'}`
      : undefined

  const searchTarget = searchMode ?? 'tasks'

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      value={searchInputValue}
      onValueChange={(value) => {
        closeHelp()
        updateInputValue(value)
      }}
      groups={visibleGroups}
      loading={isFetching}
      {...(emptyMessage == null ? {} : { emptyMessage })}
      {...(initialMessage == null ? {} : { initialMessage })}
      inputLabel={`Search ${searchTarget}`}
      dialogLabel="Search"
      placeholder={`Search ${searchTarget}...`}
      prefix={modePrefix ?? '›'}
      inputAdornment={
        <SearchModalInputAdornment
          context={context}
          searchScopes={searchScopeLabels}
          onRemoveContext={handleRemoveContext}
          onRemoveScopeToken={handleRemoveScopeToken}
        />
      }
      mobileToolbar={
        <SearchModalModeSwitcher
          modePrefix={modePrefix}
          onModeChange={handleModeChange}
        />
      }
      mobileToolbarLabel="Search mode"
      body={
        isHelpOpen ? (
          <SearchSyntaxHelpPanel
            sections={getSearchSyntaxHelpSections()}
            onBack={closeHelp}
            onKeyDown={handleHelpPanelKeyDown}
            className="flex-1"
            backButtonRef={helpBackButtonRef}
          />
        ) : undefined
      }
      footer={
        <SearchModalFooter
          canClearContext={canClearContext}
          canPopScope={canPopScope}
          canOpenHelp={searchInputValue.length === 0}
          isHelpOpen={isHelpOpen}
        />
      }
      onKeyDown={handleInputKeyDown}
      inputRef={inputRef}
    />
  )
}
