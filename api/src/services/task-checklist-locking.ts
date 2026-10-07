import { eq } from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'

import type { DbTransaction } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import {
  type ChecklistError,
  type ChecklistItem,
  fail,
} from '#services/task-checklist-errors'

export async function lockChecklist(
  tx: DbTransaction,
  checklistId: string,
): Promise<Result<typeof taskChecklists.$inferSelect, ChecklistError>> {
  const [checklist] = await tx
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.id, checklistId))
    .for('update')

  return checklist == null ? fail(404, 'Checklist not found') : ok(checklist)
}

export async function lockItemChecklist(
  tx: DbTransaction,
  itemId: string,
): Promise<Result<ChecklistItem, ChecklistError>> {
  const locked = await lockItemChecklistWith(tx, itemId, () =>
    Promise.resolve(ok(undefined)),
  )
  return locked.map(({ item }) => item)
}

export async function lockItemChecklistWith<T>(
  tx: DbTransaction,
  itemId: string,
  beforeChecklistLock: (
    item: ChecklistItem,
  ) => Promise<Result<T, ChecklistError>>,
): Promise<Result<{ item: ChecklistItem; context: T }, ChecklistError>> {
  const existing = await tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
  if (!existing) return fail(404, 'Checklist item not found')

  const before = await beforeChecklistLock(existing)
  if (before.isErr()) return err(before.error)

  const locked = await lockChecklist(tx, existing.checklistId)
  if (locked.isErr()) return err(locked.error)

  const item = await tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
  if (item == null || item.checklistId !== locked.value.id) {
    return fail(404, 'Checklist item not found')
  }
  return ok({ item, context: before.value })
}
