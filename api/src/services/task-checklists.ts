import { asc, eq } from 'drizzle-orm'

import type { DbTransaction } from '#db/connection'
import { taskChecklists, tasks } from '#db/schema'

type ChecklistRow = typeof taskChecklists.$inferSelect

function clampPosition(position: number, siblingCount: number) {
  return Math.max(0, Math.min(position, siblingCount))
}

async function lockTask(tx: DbTransaction, taskId: string) {
  const [task] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .for('update')
  return task
}

async function listTaskChecklists(tx: DbTransaction, taskId: string) {
  return tx
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.taskId, taskId))
    .orderBy(
      asc(taskChecklists.sortOrder),
      asc(taskChecklists.createdAt),
      asc(taskChecklists.id),
    )
    .for('update')
}

export async function createTaskChecklist(
  tx: DbTransaction,
  taskId: string,
  input: {
    name?: string | null | undefined
    sortOrder?: number | undefined
  },
): Promise<ChecklistRow | null> {
  if (!(await lockTask(tx, taskId))) return null
  const siblings = await listTaskChecklists(tx, taskId)
  const [created] = await tx
    .insert(taskChecklists)
    .values({ taskId, name: input.name, sortOrder: siblings.length })
    .returning()
  if (!created) return null

  const position = clampPosition(
    input.sortOrder ?? siblings.length,
    siblings.length,
  )
  const reordered = [...siblings]
  reordered.splice(position, 0, created)
  let updatedCreated = created
  const now = new Date()

  for (const [sortOrder, checklist] of reordered.entries()) {
    if (checklist.sortOrder === sortOrder) continue
    const [updated] = await tx
      .update(taskChecklists)
      .set({ sortOrder, updatedAt: now })
      .where(eq(taskChecklists.id, checklist.id))
      .returning()
    if (checklist.id === created.id && updated) updatedCreated = updated
  }

  return updatedCreated
}

export async function updateTaskChecklist(
  tx: DbTransaction,
  checklistId: string,
  input: {
    name?: string | null | undefined
    sortOrder?: number | undefined
  },
): Promise<ChecklistRow | null> {
  const [existing] = await tx
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.id, checklistId))
  if (!existing || !(await lockTask(tx, existing.taskId))) return null

  const siblings = await listTaskChecklists(tx, existing.taskId)
  const target = siblings.find((checklist) => checklist.id === checklistId)
  if (!target) return null

  if (input.sortOrder === undefined) {
    const [updated] = await tx
      .update(taskChecklists)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(taskChecklists.id, checklistId))
      .returning()
    return updated ?? null
  }

  const reordered = siblings.filter((checklist) => checklist.id !== checklistId)
  reordered.splice(clampPosition(input.sortOrder, reordered.length), 0, target)
  const now = new Date()
  let updatedTarget: ChecklistRow | null = null

  for (const [sortOrder, checklist] of reordered.entries()) {
    const isTarget = checklist.id === checklistId
    if (checklist.sortOrder === sortOrder && !isTarget) continue
    const [updated] = await tx
      .update(taskChecklists)
      .set({
        sortOrder,
        ...(isTarget ? { name: input.name } : {}),
        updatedAt: now,
      })
      .where(eq(taskChecklists.id, checklist.id))
      .returning()
    if (isTarget) updatedTarget = updated ?? null
  }

  return updatedTarget
}

export async function deleteTaskChecklist(
  tx: DbTransaction,
  checklistId: string,
): Promise<string | null> {
  const [existing] = await tx
    .select({ taskId: taskChecklists.taskId })
    .from(taskChecklists)
    .where(eq(taskChecklists.id, checklistId))
  if (!existing || !(await lockTask(tx, existing.taskId))) return null

  const [deleted] = await tx
    .delete(taskChecklists)
    .where(eq(taskChecklists.id, checklistId))
    .returning({ id: taskChecklists.id })
  return deleted != null ? existing.taskId : null
}
