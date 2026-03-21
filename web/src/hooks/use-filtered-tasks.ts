import { useContextFilter } from '@web/hooks/use-context-filter'
import type { TreeNode } from '@web/hooks/use-tasks'
import { useTaskList, useTaskTree } from '@web/hooks/use-tasks'
import {
  filterByContext,
  filterModeToApiContext,
  filterTreeByContext,
} from '@web/lib/context-filter'
import { useMemo } from 'react'

export function useFilteredTaskList() {
  const { mode } = useContextFilter()
  const apiContext = filterModeToApiContext(mode)
  const { isLoading, categorized } = useTaskList(
    apiContext ? { context: apiContext } : undefined,
  )

  const today = useMemo(
    () => filterByContext(categorized.today, mode),
    [categorized.today, mode],
  )
  const all = useMemo(
    () => filterByContext(categorized.all, mode),
    [categorized.all, mode],
  )
  const backlog = useMemo(
    () => filterByContext(categorized.backlog, mode),
    [categorized.backlog, mode],
  )
  const nonBacklog = useMemo(
    () => filterByContext(categorized.nonBacklog, mode),
    [categorized.nonBacklog, mode],
  )

  return { isLoading, today, all, backlog, nonBacklog }
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
  const { data, isLoading } = useTaskTree(options)

  const tree = useMemo(() => {
    const filtered = filterTreeByContext(data ?? [], mode)
    return mode === 'all' ? filtered : recalcChildCompletionCount(filtered)
  }, [data, mode])

  return { isLoading, tree }
}
