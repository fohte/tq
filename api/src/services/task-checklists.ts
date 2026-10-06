import { and, eq, isNull, max } from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'

import type { DbTransaction } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'

type ChecklistError = { status: 400 | 404; message: string }
type ChecklistItem = typeof taskChecklistItems.$inferSelect

function fail<T>(status: ChecklistError['status'], message: string) {
  return err<T, ChecklistError>({ status, message })
}

async function lockChecklist(
  tx: DbTransaction,
  checklistId: string,
): Promise<Result<void, ChecklistError>> {
  const [checklist] = await tx
    .select({ id: taskChecklists.id })
    .from(taskChecklists)
    .where(eq(taskChecklists.id, checklistId))
    .for('update')

  return checklist == null ? fail(404, 'Checklist not found') : ok(undefined)
}

async function lockItemChecklist(
  tx: DbTransaction,
  itemId: string,
): Promise<Result<ChecklistItem, ChecklistError>> {
  const existing = await tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
  if (!existing) return fail(404, 'Checklist item not found')

  const locked = await lockChecklist(tx, existing.checklistId)
  if (locked.isErr()) return err(locked.error)

  const item = await tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
  return item == null ? fail(404, 'Checklist item not found') : ok(item)
}

function siblingsWhere(checklistId: string, parentItemId: string | null) {
  return and(
    eq(taskChecklistItems.checklistId, checklistId),
    parentItemId == null
      ? isNull(taskChecklistItems.parentItemId)
      : eq(taskChecklistItems.parentItemId, parentItemId),
  )
}

async function getSiblings(
  tx: DbTransaction,
  checklistId: string,
  parentItemId: string | null,
) {
  return tx
    .select()
    .from(taskChecklistItems)
    .where(siblingsWhere(checklistId, parentItemId))
    .orderBy(
      taskChecklistItems.sortOrder,
      taskChecklistItems.createdAt,
      taskChecklistItems.id,
    )
}

async function nextItemSortOrder(
  tx: DbTransaction,
  checklistId: string,
  parentItemId: string | null,
): Promise<number> {
  const [row] = await tx
    .select({ sortOrder: max(taskChecklistItems.sortOrder) })
    .from(taskChecklistItems)
    .where(siblingsWhere(checklistId, parentItemId))

  return (row?.sortOrder ?? -1) + 1
}

async function getItem(
  tx: DbTransaction,
  itemId: string,
): Promise<ChecklistItem | undefined> {
  return tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
}

async function parentIsLinked(
  tx: DbTransaction,
  checklistId: string,
  parentItemId: string,
): Promise<boolean> {
  const parent = await tx.query.taskChecklistItems.findFirst({
    where: and(
      eq(taskChecklistItems.id, parentItemId),
      eq(taskChecklistItems.checklistId, checklistId),
    ),
  })

  return (
    parent == null || parent.githubLinkId != null || parent.subtaskId != null
  )
}

export async function createChecklistItem(
  tx: DbTransaction,
  checklistId: string,
  input: {
    content: string
    note?: string | null | undefined
    parentItemId?: string | null | undefined
    sortOrder?: number | undefined
  },
): Promise<Result<ChecklistItem, ChecklistError>> {
  const locked = await lockChecklist(tx, checklistId)
  if (locked.isErr()) return err(locked.error)

  const parentItemId = input.parentItemId ?? null
  if (
    parentItemId != null &&
    (await parentIsLinked(tx, checklistId, parentItemId))
  ) {
    return fail(
      400,
      'Parent item must be in this checklist and have no linked task or pull request',
    )
  }

  const [item] = await tx
    .insert(taskChecklistItems)
    .values({
      checklistId,
      parentItemId,
      content: input.content,
      note: input.note,
      sortOrder:
        input.sortOrder ??
        (await nextItemSortOrder(tx, checklistId, parentItemId)),
    })
    .returning()
  if (!item) return fail(404, 'Checklist not found')

  await recalculateChecklistAncestors(tx, [parentItemId])
  return ok(item)
}

export async function updateChecklistItem(
  tx: DbTransaction,
  itemId: string,
  input: {
    content?: string | undefined
    note?: string | null | undefined
  },
): Promise<Result<ChecklistItem, ChecklistError>> {
  const item = await lockItemChecklist(tx, itemId)
  if (item.isErr()) return err(item.error)

  const [updated] = await tx
    .update(taskChecklistItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(taskChecklistItems.id, itemId))
    .returning()
  return updated == null ? fail(404, 'Checklist item not found') : ok(updated)
}

export async function deleteChecklistItem(
  tx: DbTransaction,
  itemId: string,
): Promise<Result<void, ChecklistError>> {
  const item = await lockItemChecklist(tx, itemId)
  if (item.isErr()) return err(item.error)

  await tx.delete(taskChecklistItems).where(eq(taskChecklistItems.id, itemId))
  await recalculateChecklistAncestors(tx, [item.value.parentItemId])
  return ok(undefined)
}

export async function setChecklistItemChecked(
  tx: DbTransaction,
  itemId: string,
  checked: boolean,
): Promise<Result<ChecklistItem, ChecklistError>> {
  const itemResult = await lockItemChecklist(tx, itemId)
  if (itemResult.isErr()) return err(itemResult.error)
  const item = itemResult.value

  const [child] = await tx
    .select({ id: taskChecklistItems.id })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.parentItemId, itemId))
    .limit(1)

  if (child != null || item.githubLinkId != null || item.subtaskId != null) {
    return fail(
      400,
      'Items with children or linked tasks or pull requests cannot be checked manually',
    )
  }

  const checkedAt = checked ? (item.checkedAt ?? new Date()) : null
  const changed = item.checkedAt?.getTime() !== checkedAt?.getTime()
  const [updated] = changed
    ? await tx
        .update(taskChecklistItems)
        .set({ checkedAt, updatedAt: new Date() })
        .where(eq(taskChecklistItems.id, itemId))
        .returning()
    : [item]
  if (!updated) return fail(404, 'Checklist item not found')

  await recalculateChecklistAncestors(tx, [item.parentItemId])
  return ok(updated)
}

export async function moveChecklistItem(
  tx: DbTransaction,
  itemId: string,
  input: {
    parentItemId?: string | null | undefined
    afterItemId?: string | undefined
  },
): Promise<Result<ChecklistItem, ChecklistError>> {
  const itemResult = await lockItemChecklist(tx, itemId)
  if (itemResult.isErr()) return err(itemResult.error)
  const item = itemResult.value
  const targetParentId =
    input.parentItemId === undefined ? item.parentItemId : input.parentItemId

  if (targetParentId === itemId) {
    return fail(400, 'An item cannot be its own parent')
  }

  if (targetParentId != null) {
    const parent = await getItem(tx, targetParentId)
    if (parent == null || parent.checklistId !== item.checklistId) {
      return fail(400, 'Parent item must belong to the same checklist')
    }
    if (parent.githubLinkId != null || parent.subtaskId != null) {
      return fail(
        400,
        'Items with linked tasks or pull requests cannot have children',
      )
    }

    const visited = new Set<string>()
    let ancestorId: string | null = targetParentId
    while (ancestorId != null) {
      if (ancestorId === itemId) {
        return fail(400, 'Moving this item would create a cycle')
      }
      if (visited.has(ancestorId)) {
        return fail(400, 'The target parent chain contains a cycle')
      }
      visited.add(ancestorId)
      const ancestor = await getItem(tx, ancestorId)
      ancestorId = ancestor?.parentItemId ?? null
    }
  }

  if (input.afterItemId === itemId) {
    return fail(400, 'An item cannot be placed after itself')
  }

  const parentChanged = item.parentItemId !== targetParentId
  const oldSiblings = parentChanged
    ? await getSiblings(tx, item.checklistId, item.parentItemId)
    : []
  const targetSiblings = await getSiblings(tx, item.checklistId, targetParentId)
  const reorderedTarget = targetSiblings.filter(
    (sibling) => sibling.id !== itemId,
  )
  let insertAt = reorderedTarget.length

  if (input.afterItemId != null) {
    const afterIndex = reorderedTarget.findIndex(
      (sibling) => sibling.id === input.afterItemId,
    )
    if (afterIndex === -1) {
      return fail(
        400,
        'The after item must be a sibling in the target location',
      )
    }
    insertAt = afterIndex + 1
  } else if (!parentChanged) {
    insertAt = targetSiblings.findIndex((sibling) => sibling.id === itemId)
    if (insertAt === -1) insertAt = reorderedTarget.length
  }

  reorderedTarget.splice(insertAt, 0, item)
  const now = new Date()

  if (parentChanged) {
    let sortOrder = 0
    for (const sibling of oldSiblings) {
      if (sibling.id === itemId) continue
      if (sibling.sortOrder !== sortOrder) {
        await tx
          .update(taskChecklistItems)
          .set({ sortOrder, updatedAt: now })
          .where(eq(taskChecklistItems.id, sibling.id))
      }
      sortOrder += 1
    }
  }

  let moved: ChecklistItem | undefined
  for (const [sortOrder, sibling] of reorderedTarget.entries()) {
    const updateParent = sibling.id === itemId && parentChanged
    if (sibling.sortOrder !== sortOrder || updateParent) {
      const [updated] = await tx
        .update(taskChecklistItems)
        .set({
          ...(updateParent ? { parentItemId: targetParentId } : {}),
          sortOrder,
          updatedAt: now,
        })
        .where(eq(taskChecklistItems.id, sibling.id))
        .returning()
      if (sibling.id === itemId) moved = updated
    } else if (sibling.id === itemId) {
      moved = item
    }
  }

  await recalculateChecklistAncestors(tx, [item.parentItemId, targetParentId])
  return moved == null ? fail(404, 'Checklist item not found') : ok(moved)
}

// Call after an item changes its checked state to update each affected parent
// through the checklist root, including changes made by GitHub or subtask sync.
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
        .where(eq(taskChecklistItems.parentItemId, itemId))

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
