import { asc, type SQL, sql } from 'drizzle-orm'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { prioritySettings, tasks } from '#db/schema'
import {
  type PrioritySetting,
  updatePrioritySettingsSchema,
} from '#schemas/priority-settings'

const PRIORITY_FALLBACK_ORDER = 5

function toError(cause: unknown) {
  return cause instanceof Error ? cause : new Error(String(cause))
}

export function getPrioritySettings(): ResultAsync<PrioritySetting[], Error> {
  return ResultAsync.fromPromise(
    db
      .select({
        priority: prioritySettings.priority,
        name: prioritySettings.name,
        description: prioritySettings.description,
        sortOrder: prioritySettings.sortOrder,
      })
      .from(prioritySettings)
      .orderBy(asc(prioritySettings.sortOrder)),
    toError,
  ).andThen((settings) => {
    const parsed = updatePrioritySettingsSchema.safeParse(settings)
    return parsed.success ? okAsync(parsed.data) : errAsync(parsed.error)
  })
}

export function priorityOrderExpression(settings: PrioritySetting[]): SQL {
  if (settings.length === 0) return sql`${PRIORITY_FALLBACK_ORDER}`

  const clauses = settings.map(
    ({ priority, sortOrder }) =>
      sql`WHEN ${priority === null ? sql`${tasks.priority} IS NULL` : sql`${tasks.priority} = ${priority}`} THEN ${sortOrder}`,
  )
  return sql`CASE ${sql.join(clauses, sql` `)} ELSE ${PRIORITY_FALLBACK_ORDER} END`
}

export function prioritySortOrder(
  settings: PrioritySetting[],
  priority: number | null,
) {
  return (
    settings.find((setting) => setting.priority === priority)?.sortOrder ??
    PRIORITY_FALLBACK_ORDER
  )
}
