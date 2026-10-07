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

interface TaskLike {
  status: string
  labels: string[]
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

/**
 * Nests tasks' labels and any additional label names into a tree by splitting
 * each name on '/'. Additional names create nodes but do not contribute to
 * task counts. A path prefix with no label of its own (e.g. "dev" when only
 * "dev/tq" and "dev/infra" are ever attached directly) still appears as a
 * synthesized node. A label attached only to completed tasks still appears,
 * with count 0. Each node's count is the number of distinct non-completed tasks
 * carrying that name or any of its descendants — a task tagged with both a
 * name and one of its descendants counts once, not twice. Sorted by count
 * descending, then name ascending, at every level.
 */
export function buildTagTree(
  tasks: TaskLike[],
  additionalLabelNames: string[] = [],
): TagTreeNode[] {
  const { nodeByName, roots } = insertPaths(
    [...tasks.flatMap((task) => task.labels), ...additionalLabelNames],
    (name) => ({ name, count: 0, children: [] }),
  )

  for (const task of tasks) {
    if (task.status === 'completed') continue

    const inducedNames = new Set<string>()
    for (const label of task.labels) {
      let name = label
      // Walk up to the root, crediting each ancestor once per task even if
      // more than one of the task's labels shares that ancestor.
      for (;;) {
        inducedNames.add(name)
        const lastSlash = name.lastIndexOf('/')
        if (lastSlash === -1) break
        name = name.slice(0, lastSlash)
      }
    }
    for (const name of inducedNames) {
      const node = nodeByName.get(name)
      if (node != null) node.count += 1
    }
  }

  sortTagTree(roots)

  return roots
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
