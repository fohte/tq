import type { Task } from '#hooks/use-task-queries'

export interface TreeNode extends Task {
  children: TreeNode[]
}

/**
 * Nests a flat task list into a tree by parentId. A parent missing from
 * `tasks` (filtered out and not backfilled by includeAncestors) makes its
 * children surface as roots instead of being dropped.
 *
 * Each node keeps the childCompletionCount the server computed over ALL of
 * its children, so it can exceed `node.children.length` when the active
 * filter hides some of them — the count intentionally reflects the full
 * child set, not just what's rendered.
 */
export function buildTree(tasks: Task[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()
  for (const task of tasks) {
    nodeMap.set(task.id, { ...task, children: [] })
  }

  const roots: TreeNode[] = []
  for (const task of tasks) {
    const node = nodeMap.get(task.id)
    if (node == null) continue

    const parent =
      task.parentId != null ? nodeMap.get(task.parentId) : undefined
    if (parent != null) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

/**
 * Recursively attaches lazily-fetched children into an existing tree. For
 * each node whose id is a key in `childrenByParentId`, its `children` are
 * replaced by the fetched tasks (built into their own subtree, so any of
 * THEM that are also keys in the map get their own fetched children merged
 * in too, to arbitrary depth). A node whose id isn't in the map keeps its
 * existing `children` as-is (recursed into, in case a deeper descendant was
 * expanded independently).
 */
export function mergeLazyChildren(
  tree: TreeNode[],
  childrenByParentId: ReadonlyMap<string, Task[]>,
): TreeNode[] {
  return tree.map((node) => {
    const fetchedChildren = childrenByParentId.get(node.id)
    const children =
      fetchedChildren != null
        ? mergeLazyChildren(buildTree(fetchedChildren), childrenByParentId)
        : mergeLazyChildren(node.children, childrenByParentId)
    return { ...node, children }
  })
}
