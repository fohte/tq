export type TaskListItemWithChildren<
  T extends { id: string; parentId: string | null },
> = T & { children: TaskListItemWithChildren<T>[] }

// Nests a flat list-item response array into a tree by parentId. A row
// whose parent isn't present in the input (e.g. filtered out, or excluded by
// a `descendantOf` query) surfaces as a root instead of being dropped.
export function nestTaskListRows<
  T extends { id: string; parentId: string | null },
>(rows: T[]): Array<TaskListItemWithChildren<T>> {
  const nodeMap = new Map<string, TaskListItemWithChildren<T>>()
  for (const row of rows) {
    nodeMap.set(row.id, { ...row, children: [] })
  }

  const roots: Array<TaskListItemWithChildren<T>> = []
  for (const row of rows) {
    const node = nodeMap.get(row.id)
    if (node == null) continue

    const parent = row.parentId != null ? nodeMap.get(row.parentId) : undefined
    if (parent != null) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
