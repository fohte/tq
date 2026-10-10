import { arrayMove } from '@dnd-kit/sortable'

export interface KanbanColumnTaskIds {
  id: string
  taskIds: string[]
  acceptsDrops?: boolean
}

export type KanbanCardDropResult =
  | { type: 'move'; columnId: string }
  | { type: 'reorder'; columnId: string; taskIds: string[] }

function findColumn(
  columns: KanbanColumnTaskIds[],
  taskOrColumnId: string,
): KanbanColumnTaskIds | undefined {
  return (
    columns.find((c) => c.id === taskOrColumnId) ??
    columns.find((c) => c.taskIds.includes(taskOrColumnId))
  )
}

/**
 * Resolves a dnd-kit drag end for a queued task card into a cross-column
 * move, a same-column reorder, or null when there's nothing to do (dropped
 * outside any column, or back onto its own unchanged position).
 */
export function resolveKanbanCardDrop(
  columns: KanbanColumnTaskIds[],
  sourceColumnId: string,
  activeId: string,
  overId: string | null,
): KanbanCardDropResult | null {
  if (overId == null || activeId === overId) return null
  const sourceColumn = columns.find((column) => column.id === sourceColumnId)
  if (sourceColumn == null || sourceColumn.acceptsDrops === false) return null
  const targetColumn = findColumn(columns, overId)
  if (targetColumn == null || targetColumn.acceptsDrops === false) return null

  if (targetColumn.id !== sourceColumnId) {
    return { type: 'move', columnId: targetColumn.id }
  }

  const oldIndex = targetColumn.taskIds.indexOf(activeId)
  const newIndex = targetColumn.taskIds.indexOf(overId)
  if (oldIndex === -1 || newIndex === -1) return null

  return {
    type: 'reorder',
    columnId: targetColumn.id,
    taskIds: arrayMove(targetColumn.taskIds, oldIndex, newIndex),
  }
}

/**
 * Resolves a dnd-kit drag end for a queue candidate card into its target
 * column, or null when dropped outside any column.
 */
export function resolveKanbanCandidateDrop(
  columns: KanbanColumnTaskIds[],
  overId: string | null,
): { columnId: string } | null {
  if (overId == null) return null
  const column = findColumn(columns, overId)
  if (column == null || column.acceptsDrops === false) return null

  return { columnId: column.id }
}
