import { and, eq, isNotNull, isNull, min, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import { tasks, taskWaits } from '#db/schema'

function unresolvedTaskWaitCondition() {
  return and(eq(taskWaits.taskId, tasks.id), isNull(taskWaits.resolvedAt))
}

export function earliestUnresolvedTaskWaitFollowUpSubquery() {
  return db
    .select({ value: min(taskWaits.followUpDate) })
    .from(taskWaits)
    .where(unresolvedTaskWaitCondition())
}

export function followUpDueTaskWaitSubquery(today: string) {
  return db
    .select({ _: sql`1` })
    .from(taskWaits)
    .where(
      and(
        unresolvedTaskWaitCondition(),
        sql`${taskWaits.followUpDate} <= ${today}::date`,
      ),
    )
}

export function unacknowledgedResolvedTaskWaitSubquery() {
  return db
    .select({ _: sql`1` })
    .from(taskWaits)
    .where(
      and(
        eq(taskWaits.taskId, tasks.id),
        isNotNull(taskWaits.resolvedAt),
        isNull(taskWaits.acknowledgedAt),
      ),
    )
}
