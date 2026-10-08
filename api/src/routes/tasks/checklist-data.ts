import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import {
  checklistItemTree,
  checklistToResponse,
} from '#routes/checklist-response'
import {
  checklistItemChildrenJoin,
  getLeafChecklistItems,
} from '#services/task-checklist-leaves'

export interface ChecklistCompletionCount {
  completed: number
  total: number
}

export const EMPTY_CHECKLIST_COMPLETION_COUNT: ChecklistCompletionCount = {
  completed: 0,
  total: 0,
}

export async function getChecklistCompletionCountsByTaskId(
  taskIds: string[],
): Promise<Map<string, ChecklistCompletionCount>> {
  if (taskIds.length === 0) return new Map()

  const { children, condition } = checklistItemChildrenJoin()
  const rows = await db
    .select({
      taskId: taskChecklists.taskId,
      total: count(),
      completed: count(
        sql`CASE WHEN ${taskChecklistItems.checkedAt} IS NOT NULL THEN 1 END`,
      ),
    })
    .from(taskChecklists)
    .innerJoin(
      taskChecklistItems,
      eq(taskChecklistItems.checklistId, taskChecklists.id),
    )
    .leftJoin(children, condition)
    .where(and(inArray(taskChecklists.taskId, taskIds), isNull(children.id)))
    .groupBy(taskChecklists.taskId)

  return new Map(
    rows.map(({ taskId, completed, total }) => [taskId, { completed, total }]),
  )
}

export async function getTaskChecklistsWithItems(taskId: string) {
  const checklists = await db
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.taskId, taskId))
    .orderBy(
      asc(taskChecklists.sortOrder),
      asc(taskChecklists.createdAt),
      asc(taskChecklists.id),
    )

  const items =
    checklists.length === 0
      ? []
      : await db
          .select()
          .from(taskChecklistItems)
          .where(
            inArray(
              taskChecklistItems.checklistId,
              checklists.map((checklist) => checklist.id),
            ),
          )
          .orderBy(
            asc(taskChecklistItems.sortOrder),
            asc(taskChecklistItems.createdAt),
            asc(taskChecklistItems.id),
          )

  return { checklists, items }
}

export async function getTaskChecklistData(taskId: string) {
  const { checklists, items } = await getTaskChecklistsWithItems(taskId)

  if (checklists.length === 0) {
    return {
      checklists,
      checklistCompletionCount: EMPTY_CHECKLIST_COMPLETION_COUNT,
    }
  }

  const leafItems = getLeafChecklistItems(items)

  return {
    checklists: checklists.map((checklist) =>
      checklistToResponse(
        checklist,
        checklistItemTree(
          items.filter((item) => item.checklistId === checklist.id),
        ),
      ),
    ),
    checklistCompletionCount: {
      total: leafItems.length,
      completed: leafItems.filter((item) => item.checkedAt != null).length,
    },
  }
}
