export type ContextFilterMode = 'all' | 'work' | 'personal'

/**
 * Map filter mode to API context values.
 * - 'all' -> undefined (no filter)
 * - 'work' -> 'work'
 * - 'personal' -> undefined (filter client-side since personal includes 'personal' + 'dev')
 */
export function filterModeToApiContext(
  mode: ContextFilterMode,
): 'work' | undefined {
  switch (mode) {
    case 'work':
      return 'work'
    case 'all':
    case 'personal':
      return undefined
  }
}

/**
 * Client-side filter for tasks based on context mode.
 * Used for 'personal' mode which includes both 'personal' and 'dev' contexts.
 */
export function matchesContextFilter(
  taskContext: string,
  mode: ContextFilterMode,
): boolean {
  switch (mode) {
    case 'all':
      return true
    case 'work':
      return taskContext === 'work'
    case 'personal':
      return taskContext === 'personal' || taskContext === 'dev'
  }
}

/**
 * Filter a flat list of items by context mode.
 * Items must have a `context` property.
 */
export function filterByContext<T extends { context: string }>(
  items: T[],
  mode: ContextFilterMode,
): T[] {
  if (mode === 'all' || mode === 'work') return items
  return items.filter((t) => matchesContextFilter(t.context, mode))
}

/**
 * Filter a tree of nodes by context mode.
 * Keeps a node if it matches the filter or any of its descendants match.
 */
export function filterTreeByContext<
  T extends { context: string; children: T[] },
>(nodes: T[], mode: ContextFilterMode): T[] {
  if (mode === 'all' || mode === 'work') return nodes
  return nodes.reduce<T[]>((acc, node) => {
    const filteredChildren = filterTreeByContext(node.children, mode)
    if (
      matchesContextFilter(node.context, mode) ||
      filteredChildren.length > 0
    ) {
      acc.push({ ...node, children: filteredChildren })
    }
    return acc
  }, [])
}
