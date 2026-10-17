import { and, eq, gte, inArray, lte, or } from 'drizzle-orm'

import { db, type DbContextValue } from '#db/connection'
import {
  recurrenceRules,
  scheduleOverrides,
  scheduleRevisions,
  schedules,
} from '#db/schema'
import {
  buildScheduleOverrideIndex,
  formatDateStr,
  type ScheduleSeries,
} from '#routes/schedule-expansion'

export function buildScheduleSeries(
  schedule: typeof schedules.$inferSelect,
  revisions: Array<typeof scheduleRevisions.$inferSelect>,
  rules: Array<typeof recurrenceRules.$inferSelect>,
): ScheduleSeries {
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]))

  return {
    schedule,
    revisions: revisions.map((revision) => ({
      revision,
      rule:
        revision.recurrenceRuleId == null
          ? null
          : (ruleMap.get(revision.recurrenceRuleId) ?? null),
    })),
  }
}

async function loadRecurrenceRulesForRevisions(
  executor: DbContextValue,
  revisions: Array<typeof scheduleRevisions.$inferSelect>,
) {
  const ruleIds = uniqueRecurrenceRuleIds(revisions)
  return ruleIds.length > 0
    ? executor
        .select()
        .from(recurrenceRules)
        .where(inArray(recurrenceRules.id, ruleIds))
    : []
}

export function uniqueRecurrenceRuleIds(
  revisions: Array<typeof scheduleRevisions.$inferSelect>,
): string[] {
  return [
    ...new Set(
      revisions
        .map((revision) => revision.recurrenceRuleId)
        .filter((id): id is string => id != null),
    ),
  ]
}

export async function loadSchedulesWithRules(): Promise<ScheduleSeries[]> {
  const allSchedules = await db.select().from(schedules)
  if (allSchedules.length === 0) return []

  const allRevisions = await db
    .select()
    .from(scheduleRevisions)
    .where(
      inArray(
        scheduleRevisions.scheduleId,
        allSchedules.map((schedule) => schedule.id),
      ),
    )
    .orderBy(scheduleRevisions.scheduleId, scheduleRevisions.effectiveFrom)
  const rules = await loadRecurrenceRulesForRevisions(db, allRevisions)
  const revisionsBySchedule = new Map<
    string,
    Array<typeof scheduleRevisions.$inferSelect>
  >()

  for (const revision of allRevisions) {
    const revisionsForSchedule =
      revisionsBySchedule.get(revision.scheduleId) ?? []
    revisionsForSchedule.push(revision)
    revisionsBySchedule.set(revision.scheduleId, revisionsForSchedule)
  }

  return allSchedules.map((schedule) =>
    buildScheduleSeries(
      schedule,
      revisionsBySchedule.get(schedule.id) ?? [],
      rules,
    ),
  )
}

export async function loadScheduleWithRevisions(
  scheduleId: string,
  executor: DbContextValue = db,
): Promise<ScheduleSeries | null> {
  const schedule = await executor.query.schedules.findFirst({
    where: eq(schedules.id, scheduleId),
  })
  if (!schedule) return null

  const revisions = await executor
    .select()
    .from(scheduleRevisions)
    .where(eq(scheduleRevisions.scheduleId, scheduleId))
    .orderBy(scheduleRevisions.effectiveFrom)
  const rules = await loadRecurrenceRulesForRevisions(executor, revisions)

  return buildScheduleSeries(schedule, revisions, rules)
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
