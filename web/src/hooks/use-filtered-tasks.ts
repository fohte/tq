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

export function useFilteredTaskList(
  sortBy?: TaskSortBy,
  showCompleted = true,
  projectId?: string,
) {
  const baseFilter = useBaseFilter(showCompleted, projectId)
  const { isLoading, categorized } = useTaskList({
    ...baseFilter,
    ...(sortBy ? { sortBy } : {}),
  })

  return { isLoading, ...categorized }
}

export function useFilteredTaskTree(options: {
  enabled: boolean
  sortBy?: TaskSortBy
  showCompleted?: boolean
  projectId?: string
}) {
  const baseFilter = useBaseFilter(
    options.showCompleted ?? true,
    options.projectId,
  )
  const { isLoading, categorized } = useTaskList(
    {
      ...baseFilter,
      ...(options.sortBy ? { sortBy: options.sortBy } : {}),
      includeAncestors: true,
    },
    { enabled: options.enabled },
  )

  const tree = useMemo(() => buildTree(categorized.all), [categorized.all])

  return { isLoading, tree }
}
