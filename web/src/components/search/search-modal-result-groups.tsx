import { useMemo } from 'react'

import { createCommandItems } from '#components/search/search-modal-command-items'
import type { SearchMode } from '#components/search/search-modal-mode'
import { createRecentSearchItems } from '#components/search/search-modal-recent-item'
import {
  createOptionItem,
  createPageItems,
  createProjectItems,
  createViewItems,
  type ListItem,
  renderTaskOption,
} from '#components/search/search-modal-result-items'
import type { ResultGroup } from '#components/search/search-modal-result-list'
import type { Project } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import type {
  PageSearchResult,
  SearchResult,
  Suggestion,
} from '#hooks/use-search'
import type { NavKeybinding } from '#lib/keybindings'
import type { RecentSearchItem } from '#lib/recent-search-items'

interface SearchModalResultGroupsOptions {
  query: string
  recentItems: RecentSearchItem[]
  searchMode: SearchMode | undefined
  searchInputValue: string
  context: SearchResult['context'] | undefined
  onNewTask: (() => void) | undefined
  openRoute: (to: NavKeybinding['to']) => void
  suggestions: Suggestion[] | undefined
  tasks: SearchResult[] | undefined
  taskByNumber: SearchResult | null | undefined
  pages: PageSearchResult[] | undefined
  projects: Project[] | undefined
  savedViews: SavedView[] | undefined
  currentPrefix: string
  applySuggestion: (suggestion: Suggestion) => void
  applyScope: (scopeToken: string) => void
  openTask: (task: Pick<SearchResult, 'id'>) => void
  openProject: (project: { id: string }) => void
  openView: (view: SavedView) => void
  openPage: (page: PageSearchResult) => void
  hasAuxiliarySearch: boolean
  canSearchTasks: boolean
  canSearchProjects: boolean
  canSearchPages: boolean
  canSearchViews: boolean
  canSuggest: boolean
  hasSearchQuery: boolean
  onOpenChangeRef: { current: (open: boolean) => void }
}

export function useSearchModalResultGroups({
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
  onOpenChangeRef,
}: SearchModalResultGroupsOptions): ResultGroup[] {
  return useMemo((): ResultGroup[] => {
    const recentListItems =
      query === ''
        ? createRecentSearchItems(
            context == null
              ? recentItems
              : recentItems.filter(
                  (item) => item.context == null || item.context === context,
                ),
            openTask,
            openProject,
          )
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
  ])
}
