import type { TaskChecklistItem } from '#hooks/use-task-checklists'

export function countChecklistLeaves(items: TaskChecklistItem[]) {
  return items.reduce(
    (counts, item) => {
      if (item.children.length === 0) {
        counts.total += 1
        if (item.checkedAt != null) counts.completed += 1
        return counts
      }

      const childCounts = countChecklistLeaves(item.children)
      counts.total += childCounts.total
      counts.completed += childCounts.completed
      return counts
    },
    { completed: 0, total: 0 },
  )
}
