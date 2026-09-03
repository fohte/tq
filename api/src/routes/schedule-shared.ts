import { inArray } from 'drizzle-orm'

import { db } from '#db/connection'
import { recurrenceRules, schedules } from '#db/schema'

export async function loadSchedulesWithRules() {
  const allSchedules = await db.select().from(schedules)
  const ruleIds = [
    ...new Set(
      allSchedules
        .map((s) => s.recurrenceRuleId)
        .filter((id): id is string => id != null),
    ),
  ]
  const rules =
    ruleIds.length > 0
      ? await db
          .select()
          .from(recurrenceRules)
          .where(inArray(recurrenceRules.id, ruleIds))
      : []
  const ruleMap = new Map(rules.map((r) => [r.id, r]))

  return allSchedules.map((schedule) => ({
    schedule,
    rule:
      schedule.recurrenceRuleId != null
        ? (ruleMap.get(schedule.recurrenceRuleId) ?? null)
        : null,
  }))
}
