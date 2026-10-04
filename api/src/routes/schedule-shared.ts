import { and, gte, inArray, lte } from 'drizzle-orm'

import { db } from '#db/connection'
import { recurrenceRules, scheduleOverrides, schedules } from '#db/schema'
import {
  formatDateStr,
  type ScheduleOverrideTimes,
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

export async function loadScheduleOverridesForDateRange(
  startDate: string,
  endDate: string,
) {
  return db
    .select()
    .from(scheduleOverrides)
    .where(
      and(
        gte(scheduleOverrides.occurrenceDate, startDate),
        lte(scheduleOverrides.occurrenceDate, endDate),
      ),
    )
}

export function indexScheduleOverridesBySchedule(
  overrides: Awaited<ReturnType<typeof loadScheduleOverridesForDateRange>>,
) {
  const result = new Map<string, Map<string, ScheduleOverrideTimes>>()

  for (const override of overrides) {
    const dateOverrides =
      result.get(override.scheduleId) ??
      new Map<string, ScheduleOverrideTimes>()
    dateOverrides.set(override.occurrenceDate, override)
    result.set(override.scheduleId, dateOverrides)
  }

  return result
}

export async function loadScheduleOverridesForExpansion(
  startDate: string,
  endDate: string,
) {
  const previousDate = new Date(`${startDate}T00:00:00`)
  previousDate.setDate(previousDate.getDate() - 1)

  return indexScheduleOverridesBySchedule(
    await loadScheduleOverridesForDateRange(
      formatDateStr(previousDate),
      endDate,
    ),
  )
}
