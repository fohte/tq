import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskQueues } from '#db/schema'
import { firstOrErr, type RowNotFoundError } from '#lib/drizzle-utils'

// The focus view addresses the "today" queue by name; every other queue is
// addressed generically via the queues API.
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
