import type { TreeNode } from '#hooks/use-tasks'

export interface VisibleRow {
  id: string
  number: number
  parentId: string | null
  depth: number
}

/**
 * Flatten a task tree into the order rows are actually rendered on screen,
 * skipping the subtree of any node for which `isExpanded` returns false.
 * Used to drive Up/Down row selection, which must only step through rows the
 * user can currently see.
 */
export function flattenVisibleRows(
  tree: TreeNode[],
  isExpanded: (id: string) => boolean,
): VisibleRow[] {
  const rows: VisibleRow[] = []

  function visit(nodes: TreeNode[], depth: number) {
    for (const node of nodes) {
      rows.push({
        id: node.id,
        number: node.number,
        parentId: node.parentId,
        depth,
      })
      if (isExpanded(node.id)) {
        visit(node.children, depth + 1)
      }
    }
  }

  visit(tree, 0)
  return rows
}

/**
 * Flatten a task tree into the exact row sequence a self-recursive renderer
 * would produce: each node immediately followed by its own visible
 * children, skipping the subtree of any collapsed node.
 */
export function buildTreeRenderRows(
  tree: TreeNode[],
  options: { isExpanded: (id: string) => boolean },
): { node: TreeNode; depth: number }[] {
  const { isExpanded } = options
  const rows: { node: TreeNode; depth: number }[] = []

  function visit(node: TreeNode, depth: number) {
    rows.push({ node, depth })

    if (node.children.length > 0 && isExpanded(node.id)) {
      for (const child of node.children) {
        visit(child, depth + 1)
      }
    }
  }

  for (const node of tree) {
    visit(node, 0)
  }

  return rows
}
