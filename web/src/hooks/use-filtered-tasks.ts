import { parseSearchQuery } from 'api/search-query-parser'
import { useMemo } from 'react'

import { useContextFilter } from '#hooks/use-context-filter'
import type { TaskListFilter, TaskSortBy } from '#hooks/use-tasks'
import { useTaskList } from '#hooks/use-tasks'
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
    ...(showCompleted ? {} : { status: ['todo', 'in_progress'] }),
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

  const { isLoading, categorized } = useTaskList({
    ...baseFilter,
    ...(isSearching ? { includeAncestors: true } : { parentId: 'root' }),
  })

  const tree = useMemo(() => buildTree(categorized.all), [categorized.all])

  return {
    isLoading,
    tree,
    tasks: categorized.all,
    lazyChildrenFilter: isSearching ? undefined : baseFilter,
  }
}
