import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { db, type DbTransaction } from '#db/connection'
import { taskWaits } from '#db/schema'

type Executor = typeof db | DbTransaction
type TaskWaitRow = typeof taskWaits.$inferSelect

export interface TaskWaitSummary {
  id: string
  label: string
  followUpDate: string
  resolvedAt: string | null
}

function taskWaitSummary(
  wait: Pick<TaskWaitRow, 'id' | 'body' | 'followUpDate' | 'resolvedAt'>,
): TaskWaitSummary {
  return {
    id: wait.id,
    label: wait.body.split(/\r?\n/u, 1)[0] ?? '',
    followUpDate: wait.followUpDate,
    resolvedAt: wait.resolvedAt?.toISOString() ?? null,
  }
}

export function taskWaitToResponse(wait: TaskWaitRow) {
  return {
    ...taskWaitSummary(wait),
    taskId: wait.taskId,
    body: wait.body,
    acknowledgedAt: wait.acknowledgedAt?.toISOString() ?? null,
    createdAt: wait.createdAt.toISOString(),
  }
}

export async function listTaskWaits(
  taskId: string,
  executor: Executor = db,
): Promise<TaskWaitRow[]> {
  return executor
    .select()
    .from(taskWaits)
    .where(eq(taskWaits.taskId, taskId))
    .orderBy(asc(taskWaits.createdAt), asc(taskWaits.id))
}

export async function getTaskWaitSummariesByTaskId(
  taskIds: string[],
  executor: Executor = db,
): Promise<Map<string, TaskWaitSummary[]>> {
  if (taskIds.length === 0) return new Map()

  const rows = await executor
    .select({
      id: taskWaits.id,
      taskId: taskWaits.taskId,
      body: taskWaits.body,
      followUpDate: taskWaits.followUpDate,
      resolvedAt: taskWaits.resolvedAt,
      createdAt: taskWaits.createdAt,
    })
    .from(taskWaits)
    .where(inArray(taskWaits.taskId, taskIds))
    .orderBy(asc(taskWaits.createdAt), asc(taskWaits.id))

  const summariesByTaskId = new Map<string, TaskWaitSummary[]>()
  for (const row of rows) {
    const summaries = summariesByTaskId.get(row.taskId) ?? []
    summaries.push(taskWaitSummary(row))
    summariesByTaskId.set(row.taskId, summaries)
  }
  return summariesByTaskId
}

export async function getIncompleteTaskWaits(
  taskId: string,
  executor: Executor = db,
): Promise<TaskWaitSummary[]> {
  const rows = await executor
    .select({
      id: taskWaits.id,
      body: taskWaits.body,
      followUpDate: taskWaits.followUpDate,
      resolvedAt: taskWaits.resolvedAt,
    })
    .from(taskWaits)
    .where(and(eq(taskWaits.taskId, taskId), isNull(taskWaits.resolvedAt)))
    .orderBy(asc(taskWaits.createdAt), asc(taskWaits.id))

  return rows.map(taskWaitSummary)
}
