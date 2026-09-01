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

// Batch-fetches each task's latest `duplicate_of` target number, keyed by
// source id. A source can carry more than one row (old ones aren't deleted
// on reopen/reclose), so this keeps only the most recent.
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

// Batch-fetches each task's `blocked_by` target numbers, keyed by source
// task id.
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
// distinct nodes even if a cycle already exists, so this can't loop forever.
export async function hasBlockedByCycle(
  tx: DbTransaction,
  taskId: string,
  candidateTargetIds: string[],
): Promise<boolean> {
  if (candidateTargetIds.length === 0) return false

  const rows = await tx.execute(sql`
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

export type SyncBlockedByResult = 'ok' | 'cycle'

// Full replacement: an empty array clears every `blocked_by` relation. Owns
// its own transaction (unlike `syncTaskLabels`) so the cycle re-check and the
// write happen atomically under one advisory lock, closing the race where two
// concurrent callers each pass a pre-check and jointly create a cycle.
export async function syncTaskBlockedBy(
  taskId: string,
  blockedByIds: string[],
): Promise<SyncBlockedByResult> {
  const uniqueIds = [...new Set(blockedByIds)]

  return db.transaction(async (tx) => {
    if (uniqueIds.length > 0) {
      // A cycle can span any two tasks, so a per-task lock key can't rule
      // out two different tasks' transactions racing each other -- this
      // lock is global to all blocked_by writes.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('task_relations:blocked_by'))`,
      )
      if (await hasBlockedByCycle(tx, taskId, uniqueIds)) {
        return 'cycle'
      }
    }

    await tx
      .delete(taskRelations)
      .where(
        and(
          eq(taskRelations.sourceTaskId, taskId),
          eq(taskRelations.type, 'blocked_by'),
        ),
      )
    if (uniqueIds.length > 0) {
      await tx.insert(taskRelations).values(
        uniqueIds.map((targetTaskId) => ({
          sourceTaskId: taskId,
          targetTaskId,
          type: 'blocked_by' as const,
        })),
      )
    }

    return 'ok'
  })
}
