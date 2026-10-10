import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { err, ok, type Result, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskQueueItems, taskQueues, tasks } from '#db/schema'
import { firstOrErr, RowNotFoundError } from '#lib/drizzle-utils'
import { hasNoUnresolvedBlockersCondition } from '#services/task-blockers'

export type TaskQueue = typeof taskQueues.$inferSelect

function getQueueByKey(key: string): ResultAsync<TaskQueue, RowNotFoundError> {
  return ResultAsync.fromSafePromise(
    db.select().from(taskQueues).where(eq(taskQueues.key, key)),
  ).andThen((rows) => firstOrErr(rows))
}

// A missing queue from the generic /api/queues/:key routes is a routine 404.
export function getQueueByKeyOrRespond(c: Context, key: string) {
  return getQueueByKey(key).mapErr(() =>
    c.json({ error: 'Queue not found' }, 404),
  )
}

function formatDate(d: Date): string {
  const year = String(d.getFullYear())
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mondayOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return formatDate(d)
}

function firstOfMonth(date: string): string {
  const [year, month] = date.split('-')
  return `${year ?? ''}-${month ?? ''}-01`
}

/**
 * Round a client-supplied date down to the queue's period start, per
 * `periodUnit` (week rounds to the preceding Monday, month to the 1st, day
 * is the date itself, null/static queues have no period).
 */
export function resolvePeriodStart(
  periodUnit: TaskQueue['periodUnit'],
  date: string,
): string | null {
  switch (periodUnit) {
    case 'day':
      return date
    case 'week':
      return mondayOf(date)
    case 'month':
      return firstOfMonth(date)
    case null:
      return null
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function maxSortOrder(rows: { sortOrder: number }[]): number {
  return Math.max(-1, ...rows.map((row) => row.sortOrder))
}

export function carryOverTaskQueueItems(
  date: string,
): ResultAsync<void, Error | RowNotFoundError> {
  const weekStart = mondayOf(date)

  const transaction = db.transaction(
    async (tx): Promise<Result<void, RowNotFoundError>> => {
      const queues = await tx
        .select()
        .from(taskQueues)
        .where(inArray(taskQueues.key, ['day', 'week']))
      const dayQueue = queues.find((queue) => queue.key === 'day')
      const weekQueue = queues.find((queue) => queue.key === 'week')

      if (dayQueue == null || weekQueue == null) {
        return err(new RowNotFoundError())
      }

      const carryOverPeriod = async (
        queueId: string,
        targetPeriodStart: string,
        forwardTaskIds: ReadonlySet<string>,
      ): Promise<Set<string>> => {
        const pastPeriodCondition = and(
          eq(taskQueueItems.queueId, queueId),
          lt(taskQueueItems.periodStart, targetPeriodStart),
        )
        await tx
          .select({ id: taskQueueItems.id })
          .from(taskQueueItems)
          .where(pastPeriodCondition)
          .for('update')

        const candidates = await tx
          .select({ item: taskQueueItems })
          .from(taskQueueItems)
          .innerJoin(tasks, eq(taskQueueItems.taskId, tasks.id))
          .where(
            and(
              pastPeriodCondition,
              eq(tasks.status, 'todo'),
              hasNoUnresolvedBlockersCondition(),
            ),
          )
          .orderBy(
            asc(taskQueueItems.periodStart),
            asc(taskQueueItems.sortOrder),
            asc(taskQueueItems.id),
          )
        const rowsByTaskId = new Map<
          string,
          (typeof candidates)[number]['item'][]
        >()
        for (const { item } of candidates) {
          if (forwardTaskIds.has(item.taskId)) continue
          const rows = rowsByTaskId.get(item.taskId) ?? []
          rows.push(item)
          rowsByTaskId.set(item.taskId, rows)
        }

        const targetRows = await tx
          .select({ sortOrder: taskQueueItems.sortOrder })
          .from(taskQueueItems)
          .where(
            and(
              eq(taskQueueItems.queueId, queueId),
              eq(taskQueueItems.periodStart, targetPeriodStart),
            ),
          )
        let nextSortOrder = maxSortOrder(targetRows) + 1
        const duplicateIds: string[] = []

        for (const rows of rowsByTaskId.values()) {
          const [row, ...duplicates] = rows
          if (row == null) continue
          duplicateIds.push(...duplicates.map((duplicate) => duplicate.id))
          await tx
            .update(taskQueueItems)
            .set({
              periodStart: targetPeriodStart,
              sortOrder: nextSortOrder,
              updatedAt: new Date(),
            })
            .where(eq(taskQueueItems.id, row.id))
          nextSortOrder += 1
        }
        if (duplicateIds.length > 0) {
          await tx
            .delete(taskQueueItems)
            .where(inArray(taskQueueItems.id, duplicateIds))
        }

        return new Set(rowsByTaskId.keys())
      }

      const forwardDayRows = await tx
        .select({ taskId: taskQueueItems.taskId })
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, dayQueue.id),
            gte(taskQueueItems.periodStart, date),
          ),
        )
      const forwardWeekRows = await tx
        .select({ taskId: taskQueueItems.taskId })
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, weekQueue.id),
            gte(taskQueueItems.periodStart, weekStart),
          ),
        )
      const forwardDayTaskIds = new Set([
        ...forwardDayRows.map((row) => row.taskId),
        ...forwardWeekRows.map((row) => row.taskId),
      ])
      const movedDayTaskIds = await carryOverPeriod(
        dayQueue.id,
        date,
        forwardDayTaskIds,
      )

      const forwardWeekRowsAfterDay = await tx
        .select({ taskId: taskQueueItems.taskId })
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, weekQueue.id),
            gte(taskQueueItems.periodStart, weekStart),
          ),
        )
      const forwardDayRowsAfterDay = await tx
        .select({ taskId: taskQueueItems.taskId })
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, dayQueue.id),
            gte(taskQueueItems.periodStart, date),
          ),
        )
      const forwardWeekTaskIds = new Set([
        ...forwardWeekRowsAfterDay.map((row) => row.taskId),
        ...forwardDayRowsAfterDay.map((row) => row.taskId),
        ...movedDayTaskIds,
      ])
      await carryOverPeriod(weekQueue.id, weekStart, forwardWeekTaskIds)

      return ok(undefined)
    },
  )

  return ResultAsync.fromPromise(transaction, toError).andThen(
    (result) => result,
  )
}
