import type { taskChecklistItems, taskChecklists } from '#db/schema'

type ChecklistItemRow = typeof taskChecklistItems.$inferSelect
type ChecklistRow = typeof taskChecklists.$inferSelect

export function checklistItemToResponse(item: ChecklistItemRow) {
  return {
    id: item.id,
    checklistId: item.checklistId,
    parentItemId: item.parentItemId,
    content: item.content,
    note: item.note,
    checkedAt: item.checkedAt?.toISOString() ?? null,
    sortOrder: item.sortOrder,
    githubLinkId: item.githubLinkId,
    subtaskId: item.subtaskId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

type ChecklistItemTree = ReturnType<typeof checklistItemToResponse> & {
  children: ChecklistItemTree[]
}

export function checklistItemTree(
  rows: ChecklistItemRow[],
): ChecklistItemTree[] {
  const nodes = new Map<string, ChecklistItemTree>()
  for (const row of rows) {
    nodes.set(row.id, { ...checklistItemToResponse(row), children: [] })
  }

  const roots: ChecklistItemTree[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)
    if (node == null) continue

    const parent =
      row.parentItemId == null ? undefined : nodes.get(row.parentItemId)
    if (parent == null) roots.push(node)
    else parent.children.push(node)
  }
  return roots
}

export function checklistToResponse(
  checklist: ChecklistRow,
  items?: ChecklistItemTree[],
) {
  return {
    id: checklist.id,
    taskId: checklist.taskId,
    name: checklist.name,
    sortOrder: checklist.sortOrder,
    createdAt: checklist.createdAt.toISOString(),
    updatedAt: checklist.updatedAt.toISOString(),
    ...(items === undefined ? {} : { items }),
  }
}
