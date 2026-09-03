import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
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

// Shared route-level wiring (RowNotFoundError -> 500 response, Sentry
// capture) for the 3 today-tasks/auto-assign handlers that all look up the
// day queue before doing anything else.
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
