/**
 * Filter a flat list of items by completion status.
 */
export function filterByCompleted<T extends { status: string }>(
  items: T[],
  showCompleted: boolean,
): T[] {
  if (showCompleted) return items
  return items.filter((t) => t.status !== 'completed')
}

/**
 * Filter a tree of nodes by completion status.
 * Keeps a node if it isn't completed or any of its descendants aren't.
 */
export function filterTreeByCompleted<
  T extends { status: string; children: T[] },
>(nodes: T[], showCompleted: boolean): T[] {
  if (showCompleted) return nodes
  return nodes.reduce<T[]>((acc, node) => {
    const filteredChildren = filterTreeByCompleted(node.children, showCompleted)
    if (node.status !== 'completed' || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren })
    }
    return acc
  }, [])
}
