import { and, eq } from 'drizzle-orm'

import type { DbTransaction } from '#db/connection'
import { taskChecklistItems } from '#db/schema'

type ChecklistItem = typeof taskChecklistItems.$inferSelect

// Recalculate after child changes, including checked-state updates from GitHub
// or subtask sync.
export async function recalculateChecklistAncestors(
  tx: DbTransaction,
  parentItemIds: readonly (string | null)[],
): Promise<void> {
  for (const startingId of new Set(parentItemIds.filter((id) => id != null))) {
    const visited = new Set<string>()
    let itemId: string | null = startingId

    while (itemId != null && !visited.has(itemId)) {
      visited.add(itemId)
      const item: ChecklistItem | undefined =
        await tx.query.taskChecklistItems.findFirst({
          where: eq(taskChecklistItems.id, itemId),
        })
      if (item == null) break

      const children = await tx
        .select({ checkedAt: taskChecklistItems.checkedAt })
        .from(taskChecklistItems)
        .where(
          and(
            eq(taskChecklistItems.checklistId, item.checklistId),
            eq(taskChecklistItems.parentItemId, itemId),
          ),
        )

      if (children.length > 0) {
        const allChecked = children.every((child) => child.checkedAt != null)
        const checkedAt = allChecked ? (item.checkedAt ?? new Date()) : null
        if (item.checkedAt?.getTime() !== checkedAt?.getTime()) {
          await tx
            .update(taskChecklistItems)
            .set({ checkedAt, updatedAt: new Date() })
            .where(eq(taskChecklistItems.id, itemId))
        }
      }

      itemId = item.parentItemId
    }
  }
}
