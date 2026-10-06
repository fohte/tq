import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import {
  checklistItemTree,
  checklistToResponse,
} from '#routes/checklist-response'

export interface ChecklistCompletionCount {
  completed: number
  total: number
}

const EMPTY_CHECKLIST_COMPLETION_COUNT: ChecklistCompletionCount = {
  completed: 0,
  total: 0,
}

export async function getChecklistCompletionCountsByTaskId(
  taskIds: string[],
): Promise<Map<string, ChecklistCompletionCount>> {
  if (taskIds.length === 0) return new Map()

  const items = alias(taskChecklistItems, 'checklist_item')
  const children = alias(taskChecklistItems, 'checklist_child')
  const rows = await db
    .select({
      taskId: taskChecklists.taskId,
      total: count(),
      completed: count(
        sql`CASE WHEN ${items.checkedAt} IS NOT NULL THEN 1 END`,
      ),
    })
    .from(taskChecklists)
    .innerJoin(items, eq(items.checklistId, taskChecklists.id))
    .leftJoin(
      children,
      and(
        eq(children.checklistId, items.checklistId),
        eq(children.parentItemId, items.id),
      ),
    )
    .where(and(inArray(taskChecklists.taskId, taskIds), isNull(children.id)))
    .groupBy(taskChecklists.taskId)

  return new Map(
    rows.map(({ taskId, completed, total }) => [taskId, { completed, total }]),
  )
}

export async function getTaskChecklistData(taskId: string) {
  const checklists = await db
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.taskId, taskId))
    .orderBy(
      asc(taskChecklists.sortOrder),
      asc(taskChecklists.createdAt),
      asc(taskChecklists.id),
    )

  if (checklists.length === 0) {
    return {
      checklists: [],
      checklistCompletionCount: EMPTY_CHECKLIST_COMPLETION_COUNT,
    }
  }

  const items = await db
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

  const parentItemIds = new Set(
    items.flatMap((item) =>
      item.parentItemId == null ? [] : [item.parentItemId],
    ),
  )
  const leafItems = items.filter((item) => !parentItemIds.has(item.id))

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
