import type { Task } from '#hooks/use-task-queries'

export interface TreeNode extends Task {
  children: TreeNode[]
}

/**
 * Nests a flat task list into a tree by parentId. A parent missing from
 * `tasks` (filtered out and not backfilled by includeAncestors) makes its
 * children surface as roots instead of being dropped.
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
