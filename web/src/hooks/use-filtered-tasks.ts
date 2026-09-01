import { parseSearchQuery } from 'api/search-query-parser'
import { useCallback, useMemo } from 'react'

import { useContextFilter } from '#hooks/use-context-filter'
import type { TaskListFilter, TaskSortBy } from '#hooks/use-tasks'
import { useInfiniteTaskList, useTaskList } from '#hooks/use-tasks'
import { filterModeToApiContext } from '#lib/context-filter'
import { buildTree } from '#lib/tree-builder'

export function useBaseFilter(
  showCompleted: boolean,
  projectId?: string,
  tag?: string,
): TaskListFilter {
  const { mode } = useContextFilter()
  const apiContext = filterModeToApiContext(mode)

  return {
    ...(apiContext ? { context: apiContext } : {}),
    ...(tag != null ? { label: tag } : {}),
    ...(projectId != null ? { projectId } : {}),
    ...(showCompleted ? {} : { status: 'todo' }),
  }
}

export function useFilteredTaskList(options?: {
  sortBy?: TaskSortBy
  showCompleted?: boolean
  projectId?: string | undefined
  tag?: string | undefined
}) {
  const baseFilter = useBaseFilter(
    options?.showCompleted ?? true,
    options?.projectId,
    options?.tag,
  )
  const { isLoading, categorized } = useTaskList({
    ...baseFilter,
    ...(options?.sortBy ? { sortBy: options.sortBy } : {}),
  })

  return { isLoading, ...categorized }
}

export function useFilteredTaskTree(options: {
  q: string
  projectId?: string
}) {
  const { mode } = useContextFilter()
  const apiContext = filterModeToApiContext(mode)
  const isSearching = parseSearchQuery(options.q).freeText !== ''

  const baseFilter: TaskListFilter = {
    q: options.q,
    ...(apiContext ? { context: apiContext } : {}),
    ...(options.projectId != null ? { projectId: options.projectId } : {}),
  }

  // Mounted unconditionally per Rules of Hooks; `enabled` toggles between
  // non-paginated search and paginated root tasks.
  const searchResult = useTaskList(
    { ...baseFilter, includeAncestors: true },
    { enabled: isSearching },
  )
  const rootResult = useInfiniteTaskList(
    { ...baseFilter, parentId: 'root' },
    { enabled: !isSearching },
  )

  const tasks = isSearching ? searchResult.categorized.all : rootResult.tasks
  const tree = useMemo(() => buildTree(tasks), [tasks])

  const fetchNextPage = useCallback(() => {
    void rootResult.fetchNextPage()
  }, [rootResult.fetchNextPage])

  return {
    isLoading: isSearching ? searchResult.isLoading : rootResult.isLoading,
    tree,
    tasks,
    lazyChildrenFilter: isSearching ? undefined : baseFilter,
    hasNextPage: isSearching ? false : rootResult.hasNextPage,
    isFetchingNextPage: isSearching ? false : rootResult.isFetchingNextPage,
    isFetchNextPageError: isSearching ? false : rootResult.isFetchNextPageError,
    fetchNextPage,
  }
}
