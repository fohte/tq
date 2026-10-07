import { eq, inArray, or } from 'drizzle-orm'

import { db } from '#db/connection'
import {
  taskChecklistItems,
  taskChecklists,
  taskLinks,
  taskRelations,
} from '#db/schema'

export async function getTaskChangeEventIds(
  taskIds: readonly string[],
): Promise<string[]> {
  const uniqueTaskIds = [...new Set(taskIds)]
  if (uniqueTaskIds.length === 0) return []

  const [links, relations] = await Promise.all([
    db
      .select({
        sourceTaskId: taskLinks.sourceTaskId,
        targetTaskId: taskLinks.targetTaskId,
      })
      .from(taskLinks)
      .where(
        or(
          inArray(taskLinks.sourceTaskId, uniqueTaskIds),
          inArray(taskLinks.targetTaskId, uniqueTaskIds),
        ),
      ),
    db
      .select({
        sourceTaskId: taskRelations.sourceTaskId,
        targetTaskId: taskRelations.targetTaskId,
      })
      .from(taskRelations)
      .where(
        or(
          inArray(taskRelations.sourceTaskId, uniqueTaskIds),
          inArray(taskRelations.targetTaskId, uniqueTaskIds),
        ),
      ),
  ])

  const affectedTaskIds = new Set(uniqueTaskIds)
  for (const { sourceTaskId, targetTaskId } of [...links, ...relations]) {
    affectedTaskIds.add(sourceTaskId)
    affectedTaskIds.add(targetTaskId)
  }
  return [...affectedTaskIds]
}

export async function getOutgoingTaskLinkIds(
  taskId: string,
): Promise<string[]> {
  const links = await db
    .select({ targetTaskId: taskLinks.targetTaskId })
    .from(taskLinks)
    .where(eq(taskLinks.sourceTaskId, taskId))

  return links.map(({ targetTaskId }) => targetTaskId)
}

export function getTaskLinkChangeEventIds(
  taskId: string,
  previousTargetIds: readonly string[],
  currentTargetIds: readonly string[],
  includeTask: boolean,
): string[] {
  const previousTargets = new Set(previousTargetIds)
  const currentTargets = new Set(currentTargetIds)
  const changedTargets = [
    ...previousTargetIds.filter((id) => !currentTargets.has(id)),
    ...currentTargetIds.filter((id) => !previousTargets.has(id)),
  ]

  return [
    ...new Set([
      ...(includeTask || changedTargets.length > 0 ? [taskId] : []),
      ...changedTargets,
    ]),
  ]
}

export async function getTaskChecklistOwnerIds(
  subtaskId: string,
): Promise<string[]> {
  const checklists = await db
    .select({ taskId: taskChecklists.taskId })
    .from(taskChecklistItems)
    .innerJoin(
      taskChecklists,
      eq(taskChecklists.id, taskChecklistItems.checklistId),
    )
    .where(eq(taskChecklistItems.subtaskId, subtaskId))

  return [...new Set(checklists.map(({ taskId }) => taskId))]
}
