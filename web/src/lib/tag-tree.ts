export interface TagTreeNode {
  name: string
  count: number
  children: TagTreeNode[]
}

export interface TagCount {
  name: string
  count: number
}

export interface LabelTreeNode {
  name: string
  children: LabelTreeNode[]
}

// Splits each name on '/' and inserts it into a tree, synthesizing any
// missing ancestor (e.g. "dev" when only "dev/tq" is given) via makeNode.
function insertPaths<T extends { name: string; children: T[] }>(
  names: string[],
  makeNode: (name: string) => T,
): { nodeByName: Map<string, T>; roots: T[] } {
  const nodeByName = new Map<string, T>()
  const roots: T[] = []

  function getOrCreate(name: string): T {
    const existing = nodeByName.get(name)
    if (existing != null) return existing

    const node = makeNode(name)
    nodeByName.set(name, node)

    const lastSlash = name.lastIndexOf('/')
    if (lastSlash === -1) {
      roots.push(node)
    } else {
      getOrCreate(name.slice(0, lastSlash)).children.push(node)
    }
    return node
  }

  for (const name of names) getOrCreate(name)

  return { nodeByName, roots }
}

export function buildTagTreeFromCounts(
  counts: TagCount[],
  additionalLabelNames: string[] = [],
): TagTreeNode[] {
  const countByName = new Map(counts.map(({ name, count }) => [name, count]))
  const { roots } = insertPaths(
    [...counts.map(({ name }) => name), ...additionalLabelNames],
    (name) => ({ name, count: countByName.get(name) ?? 0, children: [] }),
  )

  sortTagTree(roots)

  return roots
}

function sortTagTree(roots: TagTreeNode[]) {
  function sortChildren(node: TagTreeNode) {
    node.children.sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    )
    node.children.forEach(sortChildren)
  }
  roots.forEach(sortChildren)
  roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/**
 * Nests label names into a tree by splitting each name on '/'. A path
 * prefix with no label of its own (e.g. "dev" when only "dev/tq" exists)
 * still appears as a synthesized node. Sorted by name ascending at every
 * level.
 */
export function buildLabelTree(names: string[]): LabelTreeNode[] {
  const { roots } = insertPaths(names, (name) => ({ name, children: [] }))

  function sortChildren(node: LabelTreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    node.children.forEach(sortChildren)
  }
  roots.forEach(sortChildren)
  roots.sort((a, b) => a.name.localeCompare(b.name))

  return roots
}

/** Pre-order flattening of a label tree, matching its rendered top-to-bottom order. */
export function flattenLabelTree(nodes: LabelTreeNode[]): string[] {
  return nodes.flatMap((node) => [
    node.name,
    ...flattenLabelTree(node.children),
  ])
}
