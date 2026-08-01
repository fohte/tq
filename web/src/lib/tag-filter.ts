/**
 * Client-side filter for tasks based on a single selected tag.
 * `null` means no filter is applied.
 */
export function matchesTagFilter(
  taskLabels: string[],
  tag: string | null,
): boolean {
  if (tag == null) return true
  return taskLabels.includes(tag)
}

export function filterByTag<T extends { labels: string[] }>(
  items: T[],
  tag: string | null,
): T[] {
  if (tag == null) return items
  return items.filter((t) => matchesTagFilter(t.labels, tag))
}

/**
 * Keeps a node if it matches the filter or any of its descendants match.
 */
export function filterTreeByTag<T extends { labels: string[]; children: T[] }>(
  nodes: T[],
  tag: string | null,
): T[] {
  if (tag == null) return nodes
  return nodes.reduce<T[]>((acc, node) => {
    const filteredChildren = filterTreeByTag(node.children, tag)
    if (matchesTagFilter(node.labels, tag) || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren })
    }
    return acc
  }, [])
}

export interface TagCount {
  name: string
  count: number
}

interface TaskLike {
  status: string
  labels: string[]
}

/**
 * Aggregate label counts across all tasks, ignoring status and any other
 * filter. A label appears in the result as soon as it's attached to any
 * task, even if its count is 0 (i.e. only attached to completed tasks).
 * Completed tasks contribute to the tag list but not to the count.
 * Sorted by count descending, then name ascending.
 */
export function computeTagCounts(tasks: TaskLike[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const task of tasks) {
    for (const label of task.labels) {
      if (!counts.has(label)) counts.set(label, 0)
      if (task.status !== 'completed') {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
