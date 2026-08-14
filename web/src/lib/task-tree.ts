import type { Task } from '#hooks/use-tasks'

/**
 * Collect the ids of every descendant of `id` within `tasks` (children,
 * grandchildren, ...). Used to keep a task from being reparented under
 * itself or one of its own descendants.
 */
export function getDescendantIds(tasks: Task[], id: string): string[] {
  return tasks
    .filter((t) => t.parentId === id)
    .flatMap((child) => [child.id, ...getDescendantIds(tasks, child.id)])
}

/**
 * Classifies a drop target row into 'child' (drop in the middle 50% of the
 * row) or 'sibling' (drop in the top/bottom quarter) based on the dragged
 * item's vertical center relative to the hovered row.
 * Returns 'child' when `activeRect` is null (no rect available yet).
 */
export function computeDropMode(
  overRect: { top: number; height: number },
  activeRect: { top: number; height: number } | null,
): 'child' | 'sibling' {
  if (activeRect == null) return 'child'
  const activeCenterY = activeRect.top + activeRect.height / 2
  const relative = (activeCenterY - overRect.top) / overRect.height
  return relative < 0.25 || relative > 0.75 ? 'sibling' : 'child'
}

/**
 * Resolves the parent id a dragged task should get for a given drop mode:
 * nested under the target ('child') or placed alongside it ('sibling').
 */
export function resolveDropParentId(
  mode: 'child' | 'sibling',
  targetNode: { id: string; parentId: string | null },
): string | null {
  return mode === 'child' ? targetNode.id : targetNode.parentId
}
