import { eq } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskQueues } from '#db/schema'
import { firstOrErr, type RowNotFoundError } from '#lib/drizzle-utils'

// The "today" queue is the only one auto-assign and the focus view depend on
// by name; every other queue is addressed generically via the queues API.
export const DAY_QUEUE_KEY = 'day'

export type TaskQueue = typeof taskQueues.$inferSelect

export function getQueueByKey(
  key: string,
): ResultAsync<TaskQueue, RowNotFoundError> {
  return ResultAsync.fromSafePromise(
    db.select().from(taskQueues).where(eq(taskQueues.key, key)),
  ).andThen((rows) => firstOrErr(rows))
}
