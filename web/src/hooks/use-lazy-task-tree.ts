import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Task, TaskListFilter, TreeNode } from '#hooks/use-tasks'
import { fetchTaskList, taskKeys } from '#hooks/use-tasks'
import { useExpandedIds } from '#hooks/use-tree-outliner'
import { mergeLazyChildren } from '#lib/tree-builder'

// Task ids are UUIDs, so this key can be shared by every lazy tree instance.
// Not used in eager mode, where toggledIds means "collapsed ids" instead —
// sharing it there would invert the meaning.
//
// ponytail: ids are never pruned, so the stored set only grows and a
// persisted id also triggers a fetch even for a tree it isn't part of.
// Filter against ids present in the currently fetched tree if this matters.
const EXPANDED_TASK_IDS_STORAGE_KEY = 'tq:expanded-task-ids'

/**
 * Builds the tree to render and its expand-state accessors. When
 * `lazyChildrenFilter` is set, the tree starts fully collapsed and a node's
 * children are fetched (via the filter, with `parentId` swapped to the
 * node's id) the first time it's expanded; otherwise `rootTree` is returned
 * as-is with every node already expanded. `hasChildren` reflects
 * `childCompletionCount.total` in lazy mode (children aren't fetched until
 * expansion) and `children.length` otherwise.
 */
export function useLazyTaskTree(
  rootTree: TreeNode[],
  lazyChildrenFilter: TaskListFilter | undefined,
) {
  const lazy = lazyChildrenFilter != null
  const { isExpanded, toggleExpand, toggledIds } = useExpandedIds(
    !lazy,
    lazy ? EXPANDED_TASK_IDS_STORAGE_KEY : undefined,
  )
  const expandedIdList = useMemo(() => [...toggledIds], [toggledIds])

  const childQueries = useQueries({
    queries: lazy
      ? expandedIdList.map((parentId) => ({
          queryKey: taskKeys.list({ ...lazyChildrenFilter, parentId }),
          queryFn: () => fetchTaskList({ ...lazyChildrenFilter, parentId }),
        }))
      : [],
  })

  // childQueries is a new array reference from useQueries on every render,
  // so memoizing tree on it wouldn't skip any renders.
  const tree = lazy
    ? mergeLazyChildren(
        rootTree,
        new Map(
          expandedIdList
            .map((parentId, i) => [parentId, childQueries[i]?.data] as const)
            .filter((entry): entry is [string, Task[]] => entry[1] != null),
        ),
      )
    : rootTree

  const hasChildren = (node: TreeNode) =>
    lazy ? node.childCompletionCount.total > 0 : node.children.length > 0

  return { tree, isExpanded, toggleExpand, hasChildren }
}
