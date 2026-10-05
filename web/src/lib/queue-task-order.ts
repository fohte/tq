interface QueueItemWithSortOrder {
  sortOrder: number
}

export function sortQueueItemsBySortOrder<T extends QueueItemWithSortOrder>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function appendQueueTaskId(
  existingTaskIds: readonly string[],
  taskId: string,
): string[] {
  return existingTaskIds.includes(taskId)
    ? [...existingTaskIds]
    : [...existingTaskIds, taskId]
}
