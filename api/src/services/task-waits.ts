import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { db, type DbTransaction } from '#db/connection'
import { taskWaits } from '#db/schema'

type Executor = typeof db | DbTransaction
type TaskWaitRow = typeof taskWaits.$inferSelect

export interface TaskWaitSummary {
  id: string
  label: string
  followUpDate: string
  githubLinkId: string | null
  resolvedAt: string | null
  acknowledgedAt: string | null
}

function taskWaitSummary(
  wait: Pick<
    TaskWaitRow,
    | 'id'
    | 'body'
    | 'followUpDate'
    | 'githubLinkId'
    | 'resolvedAt'
    | 'acknowledgedAt'
  >,
): TaskWaitSummary {
  return {
    id: wait.id,
    label: wait.body?.split(/\r?\n/u, 1)[0] ?? 'Waiting for GitHub activity',
    followUpDate: wait.followUpDate,
    githubLinkId: wait.githubLinkId,
    resolvedAt: wait.resolvedAt?.toISOString() ?? null,
    acknowledgedAt: wait.acknowledgedAt?.toISOString() ?? null,
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

export async function getUnresolvedTaskWaitSummariesByTaskId(
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
      githubLinkId: taskWaits.githubLinkId,
      resolvedAt: taskWaits.resolvedAt,
      acknowledgedAt: taskWaits.acknowledgedAt,
      createdAt: taskWaits.createdAt,
    })
    .from(taskWaits)
    .where(
      and(inArray(taskWaits.taskId, taskIds), isNull(taskWaits.resolvedAt)),
    )
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
      githubLinkId: taskWaits.githubLinkId,
      resolvedAt: taskWaits.resolvedAt,
      acknowledgedAt: taskWaits.acknowledgedAt,
    })
    .from(taskWaits)
    .where(and(eq(taskWaits.taskId, taskId), isNull(taskWaits.resolvedAt)))
    .orderBy(asc(taskWaits.createdAt), asc(taskWaits.id))

  return rows.map(taskWaitSummary)
}
