/**
 * Replaces the currently visible task slots while keeping hidden queue items
 * in their original positions. New IDs are inserted before the next visible
 * anchor, or at the end when there is no anchor.
 */
export function replaceVisibleQueueTaskIds(
  rawTaskIds: readonly string[],
  previousVisibleTaskIds: readonly string[],
  nextVisibleTaskIds: readonly string[],
): string[] {
  const previousVisibleIds = new Set(previousVisibleTaskIds)
  const nextExistingIds = nextVisibleTaskIds.filter((id) =>
    previousVisibleIds.has(id),
  )
  let nextExistingIndex = 0

  const taskIds = rawTaskIds.flatMap((id) => {
    if (!previousVisibleIds.has(id)) return [id]

    const nextId = nextExistingIds[nextExistingIndex]
    nextExistingIndex += 1
    return nextId == null ? [] : [nextId]
  })

  nextVisibleTaskIds.forEach((id, index) => {
    if (previousVisibleIds.has(id)) return

    const nextAnchor = nextVisibleTaskIds
      .slice(index + 1)
      .find((nextId) => previousVisibleIds.has(nextId))
    if (nextAnchor == null) {
      taskIds.push(id)
      return
    }

    const anchorIndex = taskIds.indexOf(nextAnchor)
    if (anchorIndex === -1) taskIds.push(id)
    else taskIds.splice(anchorIndex, 0, id)
  })

  return taskIds
}
