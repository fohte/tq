import { and, gte, inArray, lte, or } from 'drizzle-orm'

import { db } from '#db/connection'
import { recurrenceRules, scheduleOverrides, schedules } from '#db/schema'
import {
  buildScheduleOverrideIndex,
  formatDateStr,
} from '#routes/schedule-expansion'

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

function indexScheduleOverridesBySchedule(
  overrides: Array<typeof scheduleOverrides.$inferSelect>,
) {
  const overridesBySchedule = new Map<
    string,
    Array<typeof scheduleOverrides.$inferSelect>
  >()

  for (const override of overrides) {
    const scheduleOverridesForExpansion =
      overridesBySchedule.get(override.scheduleId) ?? []
    scheduleOverridesForExpansion.push(override)
    overridesBySchedule.set(override.scheduleId, scheduleOverridesForExpansion)
  }

  return new Map(
    [...overridesBySchedule].map(([scheduleId, entries]) => [
      scheduleId,
      buildScheduleOverrideIndex(entries),
    ]),
  )
}

export async function loadScheduleOverridesForExpansion(
  startDate: string,
  endDate: string,
) {
  const previousDate = new Date(`${startDate}T00:00:00`)
  previousDate.setDate(previousDate.getDate() - 1)
  const startDateWithPrevious = formatDateStr(previousDate)

  return indexScheduleOverridesBySchedule(
    await db
      .select()
      .from(scheduleOverrides)
      .where(
        or(
          and(
            gte(scheduleOverrides.occurrenceDate, startDateWithPrevious),
            lte(scheduleOverrides.occurrenceDate, endDate),
          ),
          and(
            gte(scheduleOverrides.movedToDate, startDateWithPrevious),
            lte(scheduleOverrides.movedToDate, endDate),
          ),
        ),
      )
      .orderBy(scheduleOverrides.occurrenceDate),
  )
}
