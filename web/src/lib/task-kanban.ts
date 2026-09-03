/**
 * Resolves a dnd-kit drag end into a column move, or null when there's
 * nothing to do (dropped outside a column, or back onto its own column).
 */
export function resolveKanbanDrop(
  sourceColumnId: string,
  targetColumnId: string | null,
): string | null {
  if (targetColumnId == null || targetColumnId === sourceColumnId) return null
  return targetColumnId
}
