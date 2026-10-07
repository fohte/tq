import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import { tasks, taskWaits } from '#db/schema'

export function unresolvedTaskWaitSubquery() {
  return db
    .select({ _: sql`1` })
    .from(taskWaits)
    .where(and(eq(taskWaits.taskId, tasks.id), isNull(taskWaits.resolvedAt)))
}

export function followUpDueTaskWaitSubquery(today: string) {
  return db
    .select({ _: sql`1` })
    .from(taskWaits)
    .where(
      and(
        eq(taskWaits.taskId, tasks.id),
        isNull(taskWaits.resolvedAt),
        sql`${taskWaits.followUpDate} <= ${today}::date`,
      ),
    )
}
