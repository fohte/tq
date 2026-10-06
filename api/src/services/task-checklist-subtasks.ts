import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'

import type { DbTransaction } from '#db/connection'
import {
  labels,
  taskChecklistItems,
  taskChecklists,
  taskLabels,
  tasks,
} from '#db/schema'
import type { EditAuthor } from '#lib/edits'
import { recordEdit } from '#lib/edits'
import { recalculateChecklistAncestors } from '#services/task-checklist-progress'
import { syncTaskLabels } from '#services/task-labels'

type ChecklistError = { status: 400 | 404; message: string }
type ChecklistItem = typeof taskChecklistItems.$inferSelect

function fail<T>(status: ChecklistError['status'], message: string) {
  return err<T, ChecklistError>({ status, message })
}

export async function promoteChecklistItemToSubtask(
  tx: DbTransaction,
  itemId: string,
  author: EditAuthor,
): Promise<Result<ChecklistItem, ChecklistError>> {
  const initialItem = await tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
  if (initialItem == null) return fail(404, 'Checklist item not found')

  const [initialChecklist] = await tx
    .select({ taskId: taskChecklists.taskId })
    .from(taskChecklists)
    .where(eq(taskChecklists.id, initialItem.checklistId))
  if (initialChecklist == null) return fail(404, 'Checklist item not found')

  const [parentTask] = await tx
    .select({
      id: tasks.id,
      context: tasks.context,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(eq(tasks.id, initialChecklist.taskId))
    .for('update')
  if (parentTask == null) return fail(404, 'Checklist item not found')

  const [checklist] = await tx
    .select({ id: taskChecklists.id, taskId: taskChecklists.taskId })
    .from(taskChecklists)
    .where(eq(taskChecklists.id, initialItem.checklistId))
    .for('update')
  if (checklist == null) return fail(404, 'Checklist item not found')

  const item = await tx.query.taskChecklistItems.findFirst({
    where: eq(taskChecklistItems.id, itemId),
  })
  if (item == null || item.checklistId !== checklist.id) {
    return fail(404, 'Checklist item not found')
  }
  if (item.githubLinkId != null) {
    return fail(400, 'Checklist items linked to GitHub cannot be promoted')
  }
  if (item.subtaskId != null) {
    return fail(400, 'Checklist item is already linked to a task')
  }

  const items = await tx
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.checklistId, checklist.id))
    .orderBy(
      asc(taskChecklistItems.sortOrder),
      asc(taskChecklistItems.createdAt),
      asc(taskChecklistItems.id),
    )
  const childrenByParentId = new Map<string, ChecklistItem[]>()
  for (const candidate of items) {
    if (candidate.parentItemId == null) continue
    const siblings = childrenByParentId.get(candidate.parentItemId) ?? []
    siblings.push(candidate)
    childrenByParentId.set(candidate.parentItemId, siblings)
  }

  const directChildren = childrenByParentId.get(item.id) ?? []
  const descendants: ChecklistItem[] = []
  const visited = new Set([item.id])
  const pending = [...directChildren]
  while (pending.length > 0) {
    const descendant = pending.pop()
    if (descendant == null || visited.has(descendant.id)) continue
    visited.add(descendant.id)
    descendants.push(descendant)
    pending.push(...(childrenByParentId.get(descendant.id) ?? []))
  }

  const parentLabels = await tx
    .select({ name: labels.name })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(eq(taskLabels.taskId, parentTask.id))
    .orderBy(asc(labels.name))

  const [subtask] = await tx
    .insert(tasks)
    .values({
      title: item.content,
      description: item.note,
      parentId: parentTask.id,
      projectId: parentTask.projectId,
      context: parentTask.context,
    })
    .returning()
  if (subtask == null) return fail(404, 'Parent task not found')

  await syncTaskLabels(
    tx,
    subtask.id,
    parentLabels.map(({ name }) => name),
    parentTask.context,
  )
  await recordEdit(tx, { taskId: subtask.id }, { action: 'create' }, author)

  if (directChildren.length > 0) {
    const [subtaskChecklist] = await tx
      .insert(taskChecklists)
      .values({ taskId: subtask.id, name: null, sortOrder: 0 })
      .returning()
    if (subtaskChecklist == null) {
      return fail(404, 'Subtask checklist could not be created')
    }

    const descendantIds = descendants.map(({ id }) => id)
    await tx
      .update(taskChecklistItems)
      .set({
        checklistId: subtaskChecklist.id,
        parentItemId: sql`CASE WHEN ${taskChecklistItems.parentItemId} = ${item.id} THEN NULL ELSE ${taskChecklistItems.parentItemId} END`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskChecklistItems.checklistId, checklist.id),
          inArray(taskChecklistItems.id, descendantIds),
        ),
      )
  }

  const [promoted] = await tx
    .update(taskChecklistItems)
    .set({
      subtaskId: subtask.id,
      checkedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(taskChecklistItems.id, item.id))
    .returning()
  if (promoted == null) return fail(404, 'Checklist item not found')

  await recalculateChecklistAncestors(tx, [item.parentItemId])
  return ok(promoted)
}

export async function syncChecklistItemWithSubtaskStatus(
  tx: DbTransaction,
  subtaskId: string,
  status: 'todo' | 'completed',
): Promise<void> {
  const [linkedItem] = await tx
    .select({
      id: taskChecklistItems.id,
      checklistId: taskChecklistItems.checklistId,
    })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.subtaskId, subtaskId))
  if (linkedItem == null) return

  const [checklist] = await tx
    .select({ id: taskChecklists.id })
    .from(taskChecklists)
    .where(eq(taskChecklists.id, linkedItem.checklistId))
    .for('update')
  if (checklist == null) return

  const [item] = await tx
    .select()
    .from(taskChecklistItems)
    .where(
      and(
        eq(taskChecklistItems.id, linkedItem.id),
        eq(taskChecklistItems.subtaskId, subtaskId),
      ),
    )
    .for('update')
  if (item == null) return

  const checkedAt =
    status === 'completed' ? (item.checkedAt ?? new Date()) : null
  if (item.checkedAt?.getTime() === checkedAt?.getTime()) return

  await tx
    .update(taskChecklistItems)
    .set({ checkedAt, updatedAt: new Date() })
    .where(eq(taskChecklistItems.id, item.id))
  await recalculateChecklistAncestors(tx, [item.parentItemId])
}
