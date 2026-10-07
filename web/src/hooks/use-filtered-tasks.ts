import { parseSearchQuery } from 'api/search-query-parser'
import { useCallback, useMemo } from 'react'

import { useCurrentContext } from '#hooks/use-current-context'
import type { InfiniteTaskListFilter } from '#hooks/use-tasks'
import { useInfiniteTaskList, useTaskList } from '#hooks/use-tasks'
import { buildTree } from '#lib/tree-builder'

export function useBaseFilter(
  showCompleted: boolean,
  projectId?: string,
  tag?: string,
): InfiniteTaskListFilter {
  const context = useCurrentContext()

  return {
    context,
    status: showCompleted ? 'all' : 'todo',
    ...(tag != null ? { label: tag } : {}),
    ...(projectId != null ? { projectId } : {}),
  }
}

export function useFilteredTaskTree(options: {
  q: string
  projectId?: string
}) {
  const context = useCurrentContext()
  const isSearching = parseSearchQuery(options.q).freeText !== ''

  const baseFilter: InfiniteTaskListFilter = {
    q: options.q,
    context,
    status: 'all',
    ...(options.projectId != null ? { projectId: options.projectId } : {}),
  }

  // Mounted unconditionally per Rules of Hooks; `enabled` toggles between
  // non-paginated search and paginated root tasks.
  const searchResult = useTaskList(
    { ...baseFilter, includeAncestors: true, limit: 'unlimited' },
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
    lazyChildrenFilter: isSearching
      ? undefined
      : { ...baseFilter, limit: 'unlimited' as const },
    hasNextPage: isSearching ? false : rootResult.hasNextPage,
    isFetchingNextPage: isSearching ? false : rootResult.isFetchingNextPage,
    isFetchNextPageError: isSearching ? false : rootResult.isFetchNextPageError,
    fetchNextPage,
  }
}
