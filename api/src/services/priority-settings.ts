import { asc, type SQL, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import { prioritySettings, tasks } from '#db/schema'
import {
  type PrioritySetting,
  prioritySettingSchema,
} from '#schemas/priority-settings'

export async function getPrioritySettings(): Promise<PrioritySetting[]> {
  const settings = await db
    .select({
      priority: prioritySettings.priority,
      name: prioritySettings.name,
      description: prioritySettings.description,
      sortOrder: prioritySettings.sortOrder,
    })
    .from(prioritySettings)
    .orderBy(asc(prioritySettings.sortOrder))
  return prioritySettingSchema.array().parse(settings)
}

export function priorityOrderExpression(settings: PrioritySetting[]): SQL {
  const clauses = settings.map(
    ({ priority, sortOrder }) =>
      sql`WHEN ${priority === null ? sql`${tasks.priority} IS NULL` : sql`${tasks.priority} = ${priority}`} THEN ${sortOrder}`,
  )
  return sql`CASE ${sql.join(clauses, sql` `)} ELSE 5 END`
}
