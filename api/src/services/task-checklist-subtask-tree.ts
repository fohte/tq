import type { ChecklistItem } from '#services/task-checklist-errors'

export function collectChecklistDescendants(
  items: readonly ChecklistItem[],
  rootItemId: string,
) {
  const childrenByParentId = new Map<string, ChecklistItem[]>()
  for (const item of items) {
    if (item.parentItemId == null) continue
    const siblings = childrenByParentId.get(item.parentItemId) ?? []
    siblings.push(item)
    childrenByParentId.set(item.parentItemId, siblings)
  }

  const directChildren = childrenByParentId.get(rootItemId) ?? []
  const descendants: ChecklistItem[] = []
  const visited = new Set([rootItemId])
  const pending = [...directChildren]
  while (pending.length > 0) {
    const descendant = pending.pop()
    if (descendant == null || visited.has(descendant.id)) continue
    visited.add(descendant.id)
    descendants.push(descendant)
    pending.push(...(childrenByParentId.get(descendant.id) ?? []))
  }

  return { directChildren, descendants }
}
