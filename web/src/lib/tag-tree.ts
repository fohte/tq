export interface TagTreeNode {
  name: string
  count: number
  children: TagTreeNode[]
}

export interface LabelTreeNode {
  name: string
  children: LabelTreeNode[]
}

interface TaskLike {
  status: string
  labels: string[]
}

/**
 * Nests tasks' labels into a tree by splitting each label on '/'. A path
 * prefix with no label of its own (e.g. "dev" when only "dev/tq" and
 * "dev/infra" are ever attached directly) still appears as a synthesized
 * node. A label attached only to completed tasks still appears, with count
 * 0. Each node's count is the number of distinct non-completed tasks
 * carrying that name or any of its descendants — a task tagged with both a
 * name and one of its descendants counts once, not twice. Sorted by count
 * descending, then name ascending, at every level.
 */
export function buildTagTree(tasks: TaskLike[]): TagTreeNode[] {
  const nodeByName = new Map<string, TagTreeNode>()
  const roots: TagTreeNode[] = []

  function getOrCreate(name: string): TagTreeNode {
    const existing = nodeByName.get(name)
    if (existing != null) return existing

    const node: TagTreeNode = { name, count: 0, children: [] }
    nodeByName.set(name, node)

    const lastSlash = name.lastIndexOf('/')
    if (lastSlash === -1) {
      roots.push(node)
    } else {
      getOrCreate(name.slice(0, lastSlash)).children.push(node)
    }
    return node
  }

  for (const task of tasks) {
    for (const label of task.labels) {
      getOrCreate(label)
    }
  }

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

  function sortChildren(node: TagTreeNode) {
    node.children.sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    )
    node.children.forEach(sortChildren)
  }
  roots.forEach(sortChildren)
  roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return roots
}

/**
 * Nests label names into a tree by splitting each name on '/'. A path
 * prefix with no label of its own (e.g. "dev" when only "dev/tq" exists)
 * still appears as a synthesized node. Sorted by name ascending at every
 * level. Unlike buildTagTree, this only needs the label names themselves —
 * not which tasks carry them — so it also surfaces labels no task is
 * tagged with.
 */
export function buildLabelTree(names: string[]): LabelTreeNode[] {
  const nodeByName = new Map<string, LabelTreeNode>()
  const roots: LabelTreeNode[] = []

  function getOrCreate(name: string): LabelTreeNode {
    const existing = nodeByName.get(name)
    if (existing != null) return existing

    const node: LabelTreeNode = { name, children: [] }
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
