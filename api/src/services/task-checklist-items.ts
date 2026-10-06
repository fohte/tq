import { and, eq, isNull } from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'

import type { DbTransaction } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import type { GithubIssueData } from '#integrations/github/issues'
import { RowNotFoundError } from '#lib/drizzle-utils'
import type { EditAuthor } from '#lib/edits'
import {
  type ChecklistError,
  type ChecklistItem,
  fail,
} from '#services/task-checklist-errors'
import {
  lockChecklist,
  lockItemChecklist,
} from '#services/task-checklist-locking'
import {
  checkChecklistItemsForGithubLink,
  recalculateChecklistAncestors,
} from '#services/task-checklist-progress'
import {
  getOrCreateTaskGithubLink,
  GithubResourceAlreadyLinkedError,
} from '#services/task-github-links'

function clampPosition(position: number, siblingCount: number) {
  return Math.max(0, Math.min(position, siblingCount))
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

async function getItem(
  tx: DbTransaction,
  itemId: string,
): Promise<ChecklistItem | undefined> {
  return tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
}

async function validateParentItem(
  tx: DbTransaction,
  checklistId: string,
  parentItemId: string,
): Promise<Result<void, ChecklistError>> {
  const parent = await getItem(tx, parentItemId)
  if (parent == null || parent.checklistId !== checklistId) {
    return fail(400, 'Parent item must belong to the same checklist')
  }
  if (parent.githubLinkId != null || parent.subtaskId != null) {
    return fail(
      400,
      'Items with linked tasks or pull requests cannot have children',
    )
  }
  return ok(undefined)
}

async function validateNoMoveCycle(
  tx: DbTransaction,
  itemId: string,
  parentItemId: string,
): Promise<Result<void, ChecklistError>> {
  const visited = new Set<string>()
  let ancestorId: string | null = parentItemId

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
  return ok(undefined)
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
  if (parentItemId != null) {
    const validParent = await validateParentItem(tx, checklistId, parentItemId)
    if (validParent.isErr()) return err(validParent.error)
  }

  const siblings = await getSiblings(tx, checklistId, parentItemId)
  const position = clampPosition(
    input.sortOrder ?? siblings.length,
    siblings.length,
  )
  const [item] = await tx
    .insert(taskChecklistItems)
    .values({
      checklistId,
      parentItemId,
      content: input.content,
      note: input.note,
      sortOrder: siblings.length,
    })
    .returning()
  if (!item) return fail(404, 'Checklist not found')

  const reordered = [...siblings]
  reordered.splice(position, 0, item)
  const now = new Date()
  let orderedItem = item
  for (const [sortOrder, sibling] of reordered.entries()) {
    if (sibling.sortOrder === sortOrder) continue
    const [updated] = await tx
      .update(taskChecklistItems)
      .set({ sortOrder, updatedAt: now })
      .where(eq(taskChecklistItems.id, sibling.id))
      .returning()
    if (sibling.id === item.id && updated) orderedItem = updated
  }

  await recalculateChecklistAncestors(tx, [parentItemId])
  return ok(orderedItem)
}

export async function createChecklistItemWithGithubLink(
  tx: DbTransaction,
  checklistId: string,
  input: {
    content: string
    note?: string | null | undefined
    parentItemId?: string | null | undefined
    sortOrder?: number | undefined
  },
  issue: GithubIssueData,
  author: EditAuthor,
): Promise<
  Result<
    ChecklistItem,
    ChecklistError | GithubResourceAlreadyLinkedError | RowNotFoundError
  >
> {
  const locked = await lockChecklist(tx, checklistId)
  if (locked.isErr()) return err(locked.error)

  const parentItemId = input.parentItemId ?? null
  if (parentItemId != null) {
    const validParent = await validateParentItem(tx, checklistId, parentItemId)
    if (validParent.isErr()) return err(validParent.error)
  }

  const link = await getOrCreateTaskGithubLink(
    tx,
    locked.value.taskId,
    issue,
    author,
  )
  if (link.isErr()) return err(link.error)

  const created = await createChecklistItem(tx, checklistId, input)
  if (created.isErr()) return err(created.error)

  const [updated] = await tx
    .update(taskChecklistItems)
    .set({
      githubLinkId: link.value.id,
      checkedAt: link.value.state === 'merged' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(taskChecklistItems.id, created.value.id))
    .returning()
  if (!updated) return fail(404, 'Checklist item not found')

  if (link.value.state === 'merged') {
    await checkChecklistItemsForGithubLink(tx, link.value.id)
  } else {
    await recalculateChecklistAncestors(tx, [updated.parentItemId])
  }
  return ok(updated)
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

export async function updateChecklistItemWithGithubLink(
  tx: DbTransaction,
  itemId: string,
  input: {
    content?: string | undefined
    note?: string | null | undefined
  },
  issue: GithubIssueData,
  author: EditAuthor,
): Promise<
  Result<
    ChecklistItem,
    ChecklistError | GithubResourceAlreadyLinkedError | RowNotFoundError
  >
> {
  const itemResult = await lockItemChecklist(tx, itemId)
  if (itemResult.isErr()) return err(itemResult.error)
  const item = itemResult.value

  const [child] = await tx
    .select({ id: taskChecklistItems.id })
    .from(taskChecklistItems)
    .where(
      and(
        eq(taskChecklistItems.checklistId, item.checklistId),
        eq(taskChecklistItems.parentItemId, itemId),
      ),
    )
    .limit(1)
  if (child != null || item.subtaskId != null) {
    return fail(
      400,
      'Items with children or linked tasks cannot be linked to a pull request',
    )
  }

  const checklist = await tx.query.taskChecklists.findFirst({
    where: eq(taskChecklists.id, item.checklistId),
  })
  if (checklist == null) return fail(404, 'Checklist not found')

  const link = await getOrCreateTaskGithubLink(
    tx,
    checklist.taskId,
    issue,
    author,
  )
  if (link.isErr()) return err(link.error)

  const checkedAt =
    link.value.state === 'merged' ? (item.checkedAt ?? new Date()) : null
  const [updated] = await tx
    .update(taskChecklistItems)
    .set({
      ...input,
      githubLinkId: link.value.id,
      checkedAt,
      updatedAt: new Date(),
    })
    .where(eq(taskChecklistItems.id, itemId))
    .returning()
  if (!updated) return fail(404, 'Checklist item not found')

  if (link.value.state === 'merged') {
    await checkChecklistItemsForGithubLink(tx, link.value.id)
  } else {
    await recalculateChecklistAncestors(tx, [item.parentItemId])
  }
  return ok(updated)
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
    .where(
      and(
        eq(taskChecklistItems.checklistId, item.checklistId),
        eq(taskChecklistItems.parentItemId, itemId),
      ),
    )
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
    afterItemId?: string | null | undefined
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
    const validParent = await validateParentItem(
      tx,
      item.checklistId,
      targetParentId,
    )
    if (validParent.isErr()) return err(validParent.error)

    const acyclic = await validateNoMoveCycle(tx, itemId, targetParentId)
    if (acyclic.isErr()) return err(acyclic.error)
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

  if (input.afterItemId === null) {
    insertAt = 0
  } else if (input.afterItemId !== undefined) {
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
