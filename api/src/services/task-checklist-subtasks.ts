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
import {
  type ChecklistError,
  type ChecklistItem,
  fail,
} from '#services/task-checklist-errors'
import { lockItemChecklistWith } from '#services/task-checklist-locking'
import { recalculateChecklistAncestors } from '#services/task-checklist-progress'
import { collectChecklistDescendants } from '#services/task-checklist-subtask-tree'
import { syncTaskLabels } from '#services/task-labels'

export async function promoteChecklistItemToSubtask(
  tx: DbTransaction,
  itemId: string,
  author: EditAuthor,
): Promise<Result<{ item: ChecklistItem; taskIds: string[] }, ChecklistError>> {
  type ParentTask = Pick<
    typeof tasks.$inferSelect,
    'id' | 'context' | 'projectId'
  >
  const itemResult = await lockItemChecklistWith<ParentTask>(
    tx,
    itemId,
    async (initialItem) => {
      const [checklist] = await tx
        .select({ taskId: taskChecklists.taskId })
        .from(taskChecklists)
        .where(eq(taskChecklists.id, initialItem.checklistId))
      if (checklist == null) return fail(404, 'Checklist item not found')

      const [task] = await tx
        .select({
          id: tasks.id,
          context: tasks.context,
          projectId: tasks.projectId,
        })
        .from(tasks)
        .where(eq(tasks.id, checklist.taskId))
        .for('update')
      if (task == null) return fail(404, 'Checklist item not found')

      return ok(task)
    },
  )
  if (itemResult.isErr()) return err(itemResult.error)

  const { item, context: parentTask } = itemResult.value
  const checklistId = item.checklistId
  if (item.githubLinkId != null) {
    return fail(400, 'Checklist items linked to GitHub cannot be promoted')
  }
  if (item.subtaskId != null) {
    return fail(400, 'Checklist item is already linked to a task')
  }

  const items = await tx
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.checklistId, checklistId))
    .orderBy(
      asc(taskChecklistItems.sortOrder),
      asc(taskChecklistItems.createdAt),
      asc(taskChecklistItems.id),
    )
  const { directChildren, descendants } = collectChecklistDescendants(
    items,
    item.id,
  )
  const linkedSubtaskIds = descendants.flatMap(({ subtaskId }) =>
    subtaskId == null ? [] : [subtaskId],
  )

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
  if (subtask == null) return fail(404, 'Subtask could not be created')

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
          eq(taskChecklistItems.checklistId, checklistId),
          inArray(taskChecklistItems.id, descendantIds),
        ),
      )

    if (linkedSubtaskIds.length > 0) {
      await tx
        .update(tasks)
        .set({ parentId: subtask.id, updatedAt: new Date() })
        .where(inArray(tasks.id, linkedSubtaskIds))
    }
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
  return ok({
    item: promoted,
    taskIds: [
      ...new Set([parentTask.id, subtask.id, ...linkedSubtaskIds]),
    ].sort(),
  })
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
