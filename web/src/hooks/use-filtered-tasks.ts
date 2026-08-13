import { useMemo } from 'react'

import { useContextFilter } from '#hooks/use-context-filter'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { TaskListFilter, TaskSortBy } from '#hooks/use-tasks'
import { useTaskList } from '#hooks/use-tasks'
import { filterModeToApiContext } from '#lib/context-filter'
import { buildTree } from '#lib/tree-builder'

export function useBaseFilter(showCompleted: boolean): TaskListFilter {
  const { mode } = useContextFilter()
  const { tag } = useTagFilter()
  const apiContext = filterModeToApiContext(mode)

  return {
    ...(apiContext ? { context: apiContext } : {}),
    ...(tag != null ? { label: tag } : {}),
    ...(showCompleted ? {} : { status: ['todo', 'in_progress'] }),
  }
}

export function useFilteredTaskList(sortBy?: TaskSortBy, showCompleted = true) {
  const baseFilter = useBaseFilter(showCompleted)
  const { isLoading, categorized } = useTaskList({
    ...baseFilter,
    ...(sortBy ? { sortBy } : {}),
  })

  return { isLoading, ...categorized }
}

export function useFilteredTaskTree(options: {
  sortBy?: TaskSortBy
  showCompleted?: boolean
}) {
  const baseFilter = useBaseFilter(options.showCompleted ?? true)
  const { isLoading, categorized } = useTaskList({
    ...baseFilter,
    ...(options.sortBy ? { sortBy: options.sortBy } : {}),
    includeAncestors: true,
  })

  const tree = useMemo(() => buildTree(categorized.all), [categorized.all])

  return { isLoading, tree }
}
