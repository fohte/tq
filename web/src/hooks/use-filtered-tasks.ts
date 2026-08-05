import { useMemo } from 'react'

import { useContextFilter } from '#hooks/use-context-filter'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { TaskSortBy, TreeNode } from '#hooks/use-tasks'
import { useTaskList, useTaskTree } from '#hooks/use-tasks'
import { filterByCompleted, filterTreeByCompleted } from '#lib/completed-filter'
import {
  filterByContext,
  filterModeToApiContext,
  filterTreeByContext,
} from '#lib/context-filter'
import { filterByTag, filterTreeByTag } from '#lib/tag-filter'

export function useFilteredTaskList(sortBy?: TaskSortBy, showCompleted = true) {
  const { mode } = useContextFilter()
  const { tag } = useTagFilter()
  const apiContext = filterModeToApiContext(mode)
  const { isLoading, categorized } = useTaskList({
    ...(apiContext ? { context: apiContext } : {}),
    ...(sortBy ? { sortBy } : {}),
  })

  const open = useMemo(
    () => filterByTag(filterByContext(categorized.open, mode), tag),
    [categorized.open, mode, tag],
  )
  const all = useMemo(
    () =>
      filterByCompleted(
        filterByTag(filterByContext(categorized.all, mode), tag),
        showCompleted,
      ),
    [categorized.all, mode, tag, showCompleted],
  )
  const backlog = useMemo(
    () => filterByTag(filterByContext(categorized.backlog, mode), tag),
    [categorized.backlog, mode, tag],
  )
  const nonBacklog = useMemo(
    () => filterByTag(filterByContext(categorized.nonBacklog, mode), tag),
    [categorized.nonBacklog, mode, tag],
  )

  return { isLoading, open, all, backlog, nonBacklog }
}

function recalcChildCompletionCount(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    const children = recalcChildCompletionCount(node.children)
    return {
      ...node,
      children,
      childCompletionCount: {
        total: children.length,
        completed: children.filter((c) => c.status === 'completed').length,
      },
    }
  })
}

export function useFilteredTaskTree(options: {
  enabled: boolean
  sortBy?: TaskSortBy
  showCompleted?: boolean
}) {
  const { mode } = useContextFilter()
  const { tag } = useTagFilter()
  const { data, isLoading } = useTaskTree(options)
  const showCompleted = options.showCompleted ?? true

  const tree = useMemo(() => {
    const filtered = filterTreeByCompleted(
      filterTreeByTag(filterTreeByContext(data ?? [], mode), tag),
      showCompleted,
    )
    return mode === 'all' && tag == null && showCompleted
      ? filtered
      : recalcChildCompletionCount(filtered)
  }, [data, mode, tag, showCompleted])

  return { isLoading, tree }
}
