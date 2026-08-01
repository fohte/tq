import { useMemo } from 'react'

import { useContextFilter } from '#hooks/use-context-filter'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { TreeNode } from '#hooks/use-tasks'
import { useTaskList, useTaskTree } from '#hooks/use-tasks'
import {
  filterByContext,
  filterModeToApiContext,
  filterTreeByContext,
} from '#lib/context-filter'
import { filterByTag, filterTreeByTag } from '#lib/tag-filter'

export function useFilteredTaskList() {
  const { mode } = useContextFilter()
  const { tag } = useTagFilter()
  const apiContext = filterModeToApiContext(mode)
  const { isLoading, categorized } = useTaskList(
    apiContext ? { context: apiContext } : undefined,
  )

  const open = useMemo(
    () => filterByTag(filterByContext(categorized.open, mode), tag),
    [categorized.open, mode, tag],
  )
  const all = useMemo(
    () => filterByTag(filterByContext(categorized.all, mode), tag),
    [categorized.all, mode, tag],
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

export function useFilteredTaskTree(options: { enabled: boolean }) {
  const { mode } = useContextFilter()
  const { tag } = useTagFilter()
  const { data, isLoading } = useTaskTree(options)

  const tree = useMemo(() => {
    const filtered = filterTreeByTag(filterTreeByContext(data ?? [], mode), tag)
    return mode === 'all' && tag == null
      ? filtered
      : recalcChildCompletionCount(filtered)
  }, [data, mode, tag])

  return { isLoading, tree }
}
