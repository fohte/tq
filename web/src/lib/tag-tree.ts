import type { TagCount } from '#lib/tag-counts'

export interface TagTreeNode {
  name: string
  count: number
  children: TagTreeNode[]
}

/**
 * Nests flat tag counts into a tree by splitting each name on '/'. A prefix
 * with no tag count of its own (e.g. "dev" when only "dev/tq" exists) still
 * appears as a synthesized node, with its own count treated as 0. Each
 * node's count is rolled up to include all of its descendants. Sorted by
 * count descending, then name ascending, at every level.
 */
export function buildTagTree(tagCounts: TagCount[]): TagTreeNode[] {
  const ownCountByName = new Map(
    tagCounts.map((tagCount) => [tagCount.name, tagCount.count]),
  )
  const nodeByName = new Map<string, TagTreeNode>()
  const roots: TagTreeNode[] = []

  function getOrCreate(name: string): TagTreeNode {
    const existing = nodeByName.get(name)
    if (existing != null) return existing

    const node: TagTreeNode = {
      name,
      count: ownCountByName.get(name) ?? 0,
      children: [],
    }
    nodeByName.set(name, node)

    const lastSlash = name.lastIndexOf('/')
    if (lastSlash === -1) {
      roots.push(node)
    } else {
      getOrCreate(name.slice(0, lastSlash)).children.push(node)
    }
    return node
  }

  for (const tagCount of tagCounts) {
    getOrCreate(tagCount.name)
  }

  function rollUp(node: TagTreeNode): number {
    node.count += node.children.reduce((sum, child) => sum + rollUp(child), 0)
    node.children.sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    )
    return node.count
  }
  roots.forEach(rollUp)
  roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return roots
}
