import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { err, ok, type Result, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskQueueItems, taskQueues, tasks } from '#db/schema'
import { firstOrErr, RowNotFoundError } from '#lib/drizzle-utils'

// The "today" queue is the only one auto-assign and the focus view depend on
// by name; every other queue is addressed generically via the queues API.
const DAY_QUEUE_KEY = 'day'

export type TaskQueue = typeof taskQueues.$inferSelect

function getQueueByKey(key: string): ResultAsync<TaskQueue, RowNotFoundError> {
  return ResultAsync.fromSafePromise(
    db.select().from(taskQueues).where(eq(taskQueues.key, key)),
  ).andThen((rows) => firstOrErr(rows))
}

// Shared route-level wiring (RowNotFoundError -> 500 response, Sentry
// capture) for the auto-assign handler, which looks up the day queue before
// doing anything else.
//
// No explicit return type: Hono's RPC client derives each route's response
// union from the literal `TypedResponse` returned by `c.json(...)`, so
// annotating this with a widened `Response` type would collapse that route's
// inferred response type.
export function getDayQueueOrRespond(c: Context, fingerprint: string) {
  return getQueueByKey(DAY_QUEUE_KEY).mapErr((error) => {
    captureWithFingerprint(error, fingerprint)
    return c.json({ error: 'Internal server error' }, 500)
  })
}

// Counterpart of getDayQueueOrRespond for the generic /api/queues/:key
// routes: the key comes from the request path, so a missing queue is a
// routine 404, not a Sentry-worthy misconfiguration.
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

      const pastDayCondition = and(
        eq(taskQueueItems.queueId, dayQueue.id),
        lt(taskQueueItems.periodStart, date),
      )
      await tx
        .select({ id: taskQueueItems.id })
        .from(taskQueueItems)
        .where(pastDayCondition)
        .for('update')

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
      const forwardTaskIds = new Set([
        ...forwardDayRows.map((row) => row.taskId),
        ...forwardWeekRows.map((row) => row.taskId),
      ])

      const dayCandidates = await tx
        .select({ item: taskQueueItems })
        .from(taskQueueItems)
        .innerJoin(tasks, eq(taskQueueItems.taskId, tasks.id))
        .where(and(pastDayCondition, eq(tasks.status, 'todo')))
        .orderBy(
          asc(taskQueueItems.periodStart),
          asc(taskQueueItems.sortOrder),
          asc(taskQueueItems.id),
        )
      const dayRowsByTaskId = new Map<
        string,
        (typeof dayCandidates)[number]['item'][]
      >()
      for (const { item } of dayCandidates) {
        if (forwardTaskIds.has(item.taskId)) continue
        const rows = dayRowsByTaskId.get(item.taskId) ?? []
        rows.push(item)
        dayRowsByTaskId.set(item.taskId, rows)
      }

      const todayRows = await tx
        .select({ sortOrder: taskQueueItems.sortOrder })
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, dayQueue.id),
            eq(taskQueueItems.periodStart, date),
          ),
        )
      let nextDaySortOrder = maxSortOrder(todayRows) + 1
      const movedDayTaskIds = new Set<string>()
      const duplicateDayIds: string[] = []

      for (const [taskId, rows] of dayRowsByTaskId) {
        const [row, ...duplicates] = rows
        if (row == null) continue
        movedDayTaskIds.add(taskId)
        duplicateDayIds.push(...duplicates.map((duplicate) => duplicate.id))
        await tx
          .update(taskQueueItems)
          .set({
            periodStart: date,
            sortOrder: nextDaySortOrder,
            updatedAt: new Date(),
          })
          .where(eq(taskQueueItems.id, row.id))
        nextDaySortOrder += 1
      }
      if (duplicateDayIds.length > 0) {
        await tx
          .delete(taskQueueItems)
          .where(inArray(taskQueueItems.id, duplicateDayIds))
      }

      const pastWeekCondition = and(
        eq(taskQueueItems.queueId, weekQueue.id),
        lt(taskQueueItems.periodStart, weekStart),
      )
      await tx
        .select({ id: taskQueueItems.id })
        .from(taskQueueItems)
        .where(pastWeekCondition)
        .for('update')

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

      const weekCandidates = await tx
        .select({ item: taskQueueItems })
        .from(taskQueueItems)
        .innerJoin(tasks, eq(taskQueueItems.taskId, tasks.id))
        .where(and(pastWeekCondition, eq(tasks.status, 'todo')))
        .orderBy(
          asc(taskQueueItems.periodStart),
          asc(taskQueueItems.sortOrder),
          asc(taskQueueItems.id),
        )
      const weekRowsByTaskId = new Map<
        string,
        (typeof weekCandidates)[number]['item'][]
      >()
      for (const { item } of weekCandidates) {
        if (forwardWeekTaskIds.has(item.taskId)) continue
        const rows = weekRowsByTaskId.get(item.taskId) ?? []
        rows.push(item)
        weekRowsByTaskId.set(item.taskId, rows)
      }

      const currentWeekRows = await tx
        .select({ sortOrder: taskQueueItems.sortOrder })
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, weekQueue.id),
            eq(taskQueueItems.periodStart, weekStart),
          ),
        )
      let nextWeekSortOrder = maxSortOrder(currentWeekRows) + 1
      const duplicateWeekIds: string[] = []

      for (const rows of weekRowsByTaskId.values()) {
        const [row, ...duplicates] = rows
        if (row == null) continue
        duplicateWeekIds.push(...duplicates.map((duplicate) => duplicate.id))
        await tx
          .update(taskQueueItems)
          .set({
            periodStart: weekStart,
            sortOrder: nextWeekSortOrder,
            updatedAt: new Date(),
          })
          .where(eq(taskQueueItems.id, row.id))
        nextWeekSortOrder += 1
      }
      if (duplicateWeekIds.length > 0) {
        await tx
          .delete(taskQueueItems)
          .where(inArray(taskQueueItems.id, duplicateWeekIds))
      }

      return ok(undefined)
    },
  )

  return ResultAsync.fromPromise(transaction, toError).andThen(
    (result) => result,
  )
}
