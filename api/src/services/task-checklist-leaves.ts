import { and, asc, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import type { DbTransaction } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'

export function checklistItemChildrenJoin() {
  const children = alias(taskChecklistItems, 'checklist_child')
  return {
    children,
    condition: and(
      eq(children.checklistId, taskChecklistItems.checklistId),
      eq(children.parentItemId, taskChecklistItems.id),
    ),
  }
}

export function getLeafChecklistItems<
  T extends { id: string; parentItemId: string | null },
>(items: readonly T[]): T[] {
  const parentItemIds = new Set(
    items.flatMap((item) =>
      item.parentItemId == null ? [] : [item.parentItemId],
    ),
  )
  return items.filter((item) => !parentItemIds.has(item.id))
}

export async function getUncheckedLeafChecklistItems(
  tx: DbTransaction,
  taskId: string,
) {
  const { children, condition } = checklistItemChildrenJoin()
  return tx
    .select({
      id: taskChecklistItems.id,
      checklistName: taskChecklists.name,
      content: taskChecklistItems.content,
    })
    .from(taskChecklistItems)
    .innerJoin(
      taskChecklists,
      eq(taskChecklists.id, taskChecklistItems.checklistId),
    )
    .leftJoin(children, condition)
    .where(
      and(
        eq(taskChecklists.taskId, taskId),
        isNull(taskChecklistItems.checkedAt),
        isNull(children.id),
      ),
    )
    .orderBy(
      asc(taskChecklists.sortOrder),
      asc(taskChecklists.createdAt),
      asc(taskChecklists.id),
      asc(taskChecklistItems.sortOrder),
      asc(taskChecklistItems.createdAt),
      asc(taskChecklistItems.id),
    )
}
