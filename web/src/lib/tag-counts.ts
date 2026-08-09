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
