import { useMemo } from 'react'

import { useContextFilter } from '#hooks/use-context-filter'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { TaskListFilter, TaskSortBy } from '#hooks/use-tasks'
import { useTaskList } from '#hooks/use-tasks'
import { filterModeToApiContext } from '#lib/context-filter'
import { buildTree } from '#lib/tree-builder'

export function useBaseFilter(
  showCompleted: boolean,
  projectId?: string,
): TaskListFilter {
  const { mode } = useContextFilter()
  const { tag } = useTagFilter()
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
}) {
  const baseFilter = useBaseFilter(
    options?.showCompleted ?? true,
    options?.projectId,
  )
  const { isLoading, categorized } = useTaskList({
    ...baseFilter,
    ...(options?.sortBy ? { sortBy: options.sortBy } : {}),
  })

  return { isLoading, ...categorized }
}

export function useFilteredTaskTree(options: {
  sortBy?: TaskSortBy
  showCompleted?: boolean
  projectId?: string | undefined
}) {
  const baseFilter = useBaseFilter(
    options.showCompleted ?? true,
    options.projectId,
  )
  const { isLoading, categorized } = useTaskList({
    ...baseFilter,
    ...(options.sortBy ? { sortBy: options.sortBy } : {}),
    includeAncestors: true,
  })

  const tree = useMemo(() => buildTree(categorized.all), [categorized.all])

  return { isLoading, tree, tasks: categorized.all }
}
