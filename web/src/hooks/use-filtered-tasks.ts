import { parseSearchQuery } from 'api/search-query-parser'
import { useMemo } from 'react'

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

  // Rules of Hooks bar switching between useQuery and useInfiniteQuery based
  // on isSearching, so both are always mounted and only the active one is
  // enabled. A search narrows results enough to fetch them all at once (and
  // needs includeAncestors to backfill the tree); browsing root tasks with
  // no filter can grow unbounded, so it's paginated instead.
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

  const fetchNextPage = () => {
    void rootResult.fetchNextPage()
  }

  return {
    isLoading: isSearching ? searchResult.isLoading : rootResult.isLoading,
    tree,
    tasks,
    lazyChildrenFilter: isSearching ? undefined : baseFilter,
    hasNextPage: isSearching ? false : rootResult.hasNextPage,
    isFetchingNextPage: isSearching ? false : rootResult.isFetchingNextPage,
    fetchNextPage,
  }
}
