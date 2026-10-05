interface TaskWithDueDate {
  dueDate: string | null
}

export function sortQueueTasksByDue<T extends TaskWithDueDate>(
  tasks: readonly T[],
): T[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate == null) return b.dueDate == null ? 0 : 1
    if (b.dueDate == null) return -1
    if (a.dueDate === b.dueDate) return 0
    return a.dueDate < b.dueDate ? -1 : 1
  })
}
