import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db, type DbTransaction } from '#db/connection'
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
// different task -- the earlier row is never deleted, see the "stale
// duplicateOf display after reopen/reclose" describe block in
// actions.integration.test.ts), so this keeps only the most recently created
// relation per source.
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

// Batch-fetches each task's `blocked_by` target numbers, keyed by source task
// id, for list endpoints that would otherwise issue one query per task.
// Unlike `duplicate_of`, every row is current -- `syncTaskBlockedBy` deletes
// the old set on every write instead of layering new rows on top -- so this
// returns every match rather than collapsing to the most recent one.
export async function getBlockedByNumbersByTaskId(
  taskIds: string[],
): Promise<Map<string, number[]>> {
  if (taskIds.length === 0) return new Map()

  const rows = await db
    .select({ sourceTaskId: taskRelations.sourceTaskId, number: tasks.number })
    .from(taskRelations)
    .innerJoin(tasks, eq(tasks.id, taskRelations.targetTaskId))
    .where(
      and(
        inArray(taskRelations.sourceTaskId, taskIds),
        eq(taskRelations.type, 'blocked_by'),
      ),
    )
    .orderBy(tasks.number)

  const map = new Map<string, number[]>()
  for (const row of rows) {
    const list = map.get(row.sourceTaskId) ?? []
    list.push(row.number)
    map.set(row.sourceTaskId, list)
  }
  return map
}

export interface TaskBlockedByRelations {
  // Tasks that block `taskId`.
  blockedBy: LinkedTaskDetail[]
  // Tasks that `taskId` blocks.
  blocking: LinkedTaskDetail[]
}

// The full task-list-row shape of every task on both sides of `taskId`'s
// `blocked_by` relations, for the task-detail page's blocked-by section.
export async function getTaskBlockedByRelations(
  taskId: string,
): Promise<TaskBlockedByRelations> {
  const [blockedByRows, blockingRows] = await Promise.all([
    selectTaskListRows()
      .innerJoin(taskRelations, eq(taskRelations.targetTaskId, tasks.id))
      .where(
        and(
          eq(taskRelations.sourceTaskId, taskId),
          eq(taskRelations.type, 'blocked_by'),
        ),
      )
      .orderBy(tasks.number),
    selectTaskListRows()
      .innerJoin(taskRelations, eq(taskRelations.sourceTaskId, tasks.id))
      .where(
        and(
          eq(taskRelations.targetTaskId, taskId),
          eq(taskRelations.type, 'blocked_by'),
        ),
      )
      .orderBy(tasks.number),
  ])

  // Hydrated together (not per-direction) so labels/child-completion counts
  // are still fetched in a fixed number of queries regardless of how many
  // blockedBy vs. blocking relations exist. Mirrors `getTaskLinks`.
  const hydrated = await hydrateTaskListRows([
    ...blockedByRows,
    ...blockingRows,
  ])

  return {
    blockedBy: hydrated.slice(0, blockedByRows.length),
    blocking: hydrated.slice(blockedByRows.length),
  }
}

// True when adding a `blocked_by` edge from `taskId` to any id in
// `candidateTargetIds` would create a cycle, i.e. `taskId` is already
// reachable from one of the candidates by following existing `blocked_by`
// edges. `UNION` (not `UNION ALL`) bounds the traversal to the graph's
// distinct nodes even if a cycle already existed, so a data inconsistency
// can't turn this into an infinite loop.
export async function hasBlockedByCycle(
  taskId: string,
  candidateTargetIds: string[],
): Promise<boolean> {
  if (candidateTargetIds.length === 0) return false

  const rows = await db.execute(sql`
    WITH RECURSIVE reachable AS (
      SELECT target_task_id AS id FROM ${taskRelations}
      WHERE source_task_id IN (${sql.join(candidateTargetIds, sql`, `)})
        AND type = 'blocked_by'
      UNION
      SELECT tr.target_task_id
      FROM ${taskRelations} tr
      INNER JOIN reachable r ON tr.source_task_id = r.id
      WHERE tr.type = 'blocked_by'
    )
    SELECT id FROM reachable WHERE id = ${taskId}
  `)

  return z.array(z.object({ id: z.string() })).parse(rows).length > 0
}

// Full replacement, not add/remove: callers must pass the complete desired
// set of blocker task ids each time, so an empty array clears every
// `blocked_by` relation from the task. Callers are responsible for cycle and
// existence checks before calling this (see `hasBlockedByCycle`) -- this
// function only writes.
export async function syncTaskBlockedBy(
  tx: DbTransaction,
  taskId: string,
  blockedByIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(blockedByIds)]

  await tx
    .delete(taskRelations)
    .where(
      and(
        eq(taskRelations.sourceTaskId, taskId),
        eq(taskRelations.type, 'blocked_by'),
      ),
    )
  if (uniqueIds.length === 0) return

  await tx.insert(taskRelations).values(
    uniqueIds.map((targetTaskId) => ({
      sourceTaskId: taskId,
      targetTaskId,
      type: 'blocked_by' as const,
    })),
  )
}
