import { and, desc, eq, inArray } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskRelations, tasks } from '#db/schema'
import { selectTaskListRows } from '#routes/tasks/list-query'
import {
  hydrateTaskListRows,
  type TaskListItemResponse,
} from '#routes/tasks/shared'

// Mirrors `LinkedTaskDetail` in task-links.ts: the task-detail page renders
// a duplicate-of target with the same row appearance as any other linked
// task.
type LinkedTaskDetail = TaskListItemResponse & {
  childCompletionCount: { completed: number; total: number }
}

// Batch-fetches each task's `duplicate_of` target number, keyed by source
// task id, for list endpoints that would otherwise issue one query per task.
// A source can in principle carry more than one `duplicate_of` row (e.g.
// closed as a duplicate, reopened, then closed again as a duplicate of a
// different task -- the earlier row is never deleted, see
// task-relations.integration.test.ts), so this keeps only the most recently
// created relation per source.
export async function getDuplicateOfNumbersByTaskId(
  taskIds: string[],
): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map()

  const rows = await db
    .selectDistinctOn([taskRelations.sourceTaskId], {
      sourceTaskId: taskRelations.sourceTaskId,
      number: tasks.number,
    })
    .from(taskRelations)
    .innerJoin(tasks, eq(tasks.id, taskRelations.targetTaskId))
    .where(
      and(
        inArray(taskRelations.sourceTaskId, taskIds),
        eq(taskRelations.type, 'duplicate_of'),
      ),
    )
    .orderBy(taskRelations.sourceTaskId, desc(taskRelations.createdAt))

  return new Map(rows.map((row) => [row.sourceTaskId, row.number]))
}

// The full task-list-row shape of the task `taskId` is a `duplicate_of`, for
// the task-detail page's "Duplicate of" block. `null` when the task has no
// `duplicate_of` relation. See `getDuplicateOfNumbersByTaskId` for why the
// most recently created relation wins when more than one exists.
export async function getDuplicateOfTask(
  taskId: string,
): Promise<LinkedTaskDetail | null> {
  const [relation] = await db
    .select({ targetTaskId: taskRelations.targetTaskId })
    .from(taskRelations)
    .where(
      and(
        eq(taskRelations.sourceTaskId, taskId),
        eq(taskRelations.type, 'duplicate_of'),
      ),
    )
    .orderBy(desc(taskRelations.createdAt))
    .limit(1)

  if (!relation) return null

  const rows = await selectTaskListRows().where(
    eq(tasks.id, relation.targetTaskId),
  )
  const [hydrated] = await hydrateTaskListRows(rows)
  return hydrated ?? null
}
