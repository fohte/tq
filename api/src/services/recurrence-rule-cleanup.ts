import { and, eq, sql } from 'drizzle-orm'

import type { DbTransaction } from '#db/connection'
import { recurrenceRules, tasks } from '#db/schema'

// Deletes `recurrenceRules` row `ruleId` if no other task still references it
// directly, so redirecting or clearing a legacy directly-owned rule doesn't
// leave it orphaned. `excludeTaskId` is the task being updated/deleted itself,
// whose own row may still carry the stale reference at the time of this check.
export async function deleteRecurrenceRuleIfUnreferenced(
  tx: DbTransaction,
  ruleId: string,
  excludeTaskId?: string,
) {
  const [otherRef] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      excludeTaskId != null
        ? and(
            eq(tasks.recurrenceRuleId, ruleId),
            sql`${tasks.id} != ${excludeTaskId}`,
          )
        : eq(tasks.recurrenceRuleId, ruleId),
    )
    .limit(1)
  if (!otherRef) {
    await tx.delete(recurrenceRules).where(eq(recurrenceRules.id, ruleId))
  }
}
