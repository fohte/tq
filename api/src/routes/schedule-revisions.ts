import { and, eq, gte, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { db, type DbTransaction } from '#db/connection'
import {
  recurrenceRules,
  recurringTaskTemplates,
  scheduleOverrides,
  scheduleRevisions,
  schedules,
  tasks,
} from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import {
  getScheduleRevisionForDate,
  scheduleOccursOnDate,
  type ScheduleRevisionWithRule,
  type ScheduleSeries,
} from '#routes/schedule-expansion'
import { buildScheduleSeries } from '#routes/schedule-shared'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'
import { createScheduleSchema, updateScheduleSchema } from '#schemas/schedule'

type RecurrenceInput = z.infer<typeof recurrenceRuleSchema>
type CreateScheduleInput = z.infer<typeof createScheduleSchema>
type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>

export type UpdateScheduleSeriesResult =
  | { kind: 'missing' }
  | { kind: 'invalid'; message: string }
  | {
      kind: 'updated'
      series: ScheduleSeries
      responseRevision: ScheduleRevisionWithRule
    }

async function createRecurrenceRule(
  tx: DbTransaction,
  recurrence: RecurrenceInput,
) {
  return firstOrThrow(
    await tx
      .insert(recurrenceRules)
      .values({
        type: recurrence.type,
        interval: recurrence.interval,
        daysOfWeek: recurrence.daysOfWeek ?? null,
        dayOfMonth: recurrence.dayOfMonth ?? null,
      })
      .returning(),
  )
}

async function loadScheduleSeries(
  tx: DbTransaction,
  schedule: typeof schedules.$inferSelect,
) {
  const revisions = await tx
    .select()
    .from(scheduleRevisions)
    .where(eq(scheduleRevisions.scheduleId, schedule.id))
    .orderBy(scheduleRevisions.effectiveFrom)
  const ruleIds = [
    ...new Set(
      revisions
        .map((revision) => revision.recurrenceRuleId)
        .filter((id): id is string => id != null),
    ),
  ]
  const rules =
    ruleIds.length > 0
      ? await tx
          .select()
          .from(recurrenceRules)
          .where(inArray(recurrenceRules.id, ruleIds))
      : []

  return buildScheduleSeries(schedule, revisions, rules)
}

async function deleteUnreferencedRecurrenceRules(
  tx: DbTransaction,
  recurrenceRuleIds: string[],
) {
  if (recurrenceRuleIds.length === 0) return

  const [taskRules, templateRules, scheduleRules] = await Promise.all([
    tx
      .select({ recurrenceRuleId: tasks.recurrenceRuleId })
      .from(tasks)
      .where(inArray(tasks.recurrenceRuleId, recurrenceRuleIds)),
    tx
      .select({ recurrenceRuleId: recurringTaskTemplates.recurrenceRuleId })
      .from(recurringTaskTemplates)
      .where(
        inArray(recurringTaskTemplates.recurrenceRuleId, recurrenceRuleIds),
      ),
    tx
      .select({ recurrenceRuleId: scheduleRevisions.recurrenceRuleId })
      .from(scheduleRevisions)
      .where(inArray(scheduleRevisions.recurrenceRuleId, recurrenceRuleIds)),
  ])
  const referencedIds = new Set(
    [...taskRules, ...templateRules, ...scheduleRules].flatMap(
      ({ recurrenceRuleId }) =>
        recurrenceRuleId == null ? [] : [recurrenceRuleId],
    ),
  )
  const unreferencedIds = recurrenceRuleIds.filter(
    (recurrenceRuleId) => !referencedIds.has(recurrenceRuleId),
  )

  if (unreferencedIds.length === 0) return
  await tx
    .delete(recurrenceRules)
    .where(inArray(recurrenceRules.id, unreferencedIds))
}

function uniqueRecurrenceRuleIds(
  revisions: ScheduleSeries['revisions'],
): string[] {
  return [
    ...new Set(
      revisions
        .map(({ revision }) => revision.recurrenceRuleId)
        .filter((id): id is string => id != null),
    ),
  ]
}

export async function createScheduleSeries(
  input: CreateScheduleInput,
): Promise<ScheduleSeries> {
  return db.transaction(async (tx) => {
    const schedule = firstOrThrow(
      await tx
        .insert(schedules)
        .values({
          title: input.title,
          context: input.context ?? 'personal',
          color: input.color ?? null,
        })
        .returning(),
    )
    const rule =
      input.recurrence == null
        ? null
        : await createRecurrenceRule(tx, input.recurrence)
    const revision = firstOrThrow(
      await tx
        .insert(scheduleRevisions)
        .values({
          scheduleId: schedule.id,
          effectiveFrom: input.startDate,
          startTime: input.startTime,
          endTime: input.endTime,
          recurrenceRuleId: rule?.id ?? null,
        })
        .returning(),
    )

    return buildScheduleSeries(schedule, [revision], rule ? [rule] : [])
  })
}

export async function updateScheduleSeries(
  scheduleId: string,
  input: UpdateScheduleInput,
): Promise<UpdateScheduleSeriesResult> {
  return db.transaction(async (tx) => {
    const schedule = await tx.query.schedules.findFirst({
      where: eq(schedules.id, scheduleId),
    })
    if (!schedule) return { kind: 'missing' }

    const series = await loadScheduleSeries(tx, schedule)
    const firstRevision = series.revisions[0]
    if (!firstRevision) {
      return { kind: 'invalid', message: 'Schedule has no revisions' }
    }

    const firstDate = input.startDate ?? firstRevision.revision.effectiveFrom
    const endDate =
      input.endDate === undefined ? schedule.endDate : input.endDate
    if (endDate != null && endDate < firstDate) {
      return {
        kind: 'invalid',
        message: 'endDate must be on or after the schedule start date',
      }
    }
    if (
      input.effectiveFrom !== undefined &&
      input.effectiveFrom < firstRevision.revision.effectiveFrom
    ) {
      return {
        kind: 'invalid',
        message: 'effectiveFrom must be on or after the schedule start date',
      }
    }

    const now = new Date()
    const hasRevisionChanges =
      input.startTime !== undefined ||
      input.endTime !== undefined ||
      input.recurrence !== undefined
    const shouldReplaceAllRevisions =
      input.startDate !== undefined || input.recurrence === null
    const oldRecurrenceRuleIds = uniqueRecurrenceRuleIds(series.revisions)

    if (input.effectiveFrom !== undefined) {
      const activeRevision = getScheduleRevisionForDate(
        series.revisions,
        input.effectiveFrom,
      )
      if (!activeRevision) {
        return {
          kind: 'invalid',
          message: 'effectiveFrom must be on or after the schedule start date',
        }
      }

      if (hasRevisionChanges) {
        const recurrenceRuleId =
          input.recurrence === undefined
            ? activeRevision.revision.recurrenceRuleId
            : input.recurrence === null
              ? null
              : (await createRecurrenceRule(tx, input.recurrence)).id
        const revisionValues = {
          startTime: input.startTime ?? activeRevision.revision.startTime,
          endTime: input.endTime ?? activeRevision.revision.endTime,
          recurrenceRuleId,
        }

        await tx
          .insert(scheduleRevisions)
          .values({
            scheduleId,
            effectiveFrom: input.effectiveFrom,
            ...revisionValues,
          })
          .onConflictDoUpdate({
            target: [
              scheduleRevisions.scheduleId,
              scheduleRevisions.effectiveFrom,
            ],
            set: { ...revisionValues, updatedAt: now },
          })
        if (
          activeRevision.revision.recurrenceRuleId != null &&
          activeRevision.revision.recurrenceRuleId !== recurrenceRuleId
        ) {
          await deleteUnreferencedRecurrenceRules(tx, [
            activeRevision.revision.recurrenceRuleId,
          ])
        }
      }
    } else if (shouldReplaceAllRevisions) {
      const recurrenceRuleId =
        input.recurrence === undefined
          ? firstRevision.revision.recurrenceRuleId
          : input.recurrence === null
            ? null
            : (await createRecurrenceRule(tx, input.recurrence)).id

      await tx
        .delete(scheduleRevisions)
        .where(eq(scheduleRevisions.scheduleId, scheduleId))
      await tx.insert(scheduleRevisions).values({
        scheduleId,
        effectiveFrom: firstDate,
        startTime: input.startTime ?? firstRevision.revision.startTime,
        endTime: input.endTime ?? firstRevision.revision.endTime,
        recurrenceRuleId,
        updatedAt: now,
      })
      await deleteUnreferencedRecurrenceRules(
        tx,
        oldRecurrenceRuleIds.filter((id) => id !== recurrenceRuleId),
      )
    } else if (hasRevisionChanges) {
      const revisionUpdates: Partial<typeof scheduleRevisions.$inferInsert> = {
        updatedAt: now,
      }
      if (input.startTime !== undefined) {
        revisionUpdates.startTime = input.startTime
      }
      if (input.endTime !== undefined) {
        revisionUpdates.endTime = input.endTime
      }
      if (input.recurrence !== undefined) {
        revisionUpdates.recurrenceRuleId =
          input.recurrence === null
            ? null
            : (await createRecurrenceRule(tx, input.recurrence)).id
      }

      await tx
        .update(scheduleRevisions)
        .set(revisionUpdates)
        .where(eq(scheduleRevisions.scheduleId, scheduleId))
      if (input.recurrence !== undefined) {
        await deleteUnreferencedRecurrenceRules(tx, oldRecurrenceRuleIds)
      }
    }

    const updatedSchedule = firstOrThrow(
      await tx
        .update(schedules)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.context !== undefined
            ? { context: input.context ?? 'personal' }
            : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          updatedAt: now,
        })
        .where(eq(schedules.id, scheduleId))
        .returning(),
    )
    const updatedSeries = await loadScheduleSeries(tx, updatedSchedule)

    if (input.effectiveFrom !== undefined && hasRevisionChanges) {
      const overrides = await tx
        .select()
        .from(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.scheduleId, scheduleId),
            gte(scheduleOverrides.occurrenceDate, input.effectiveFrom),
          ),
        )
      const obsoleteOccurrenceDates = overrides
        .filter(
          (override) =>
            !scheduleOccursOnDate(
              updatedSeries,
              new Date(override.occurrenceDate + 'T00:00:00'),
            ),
        )
        .map((override) => override.occurrenceDate)

      if (obsoleteOccurrenceDates.length > 0) {
        await tx
          .delete(scheduleOverrides)
          .where(
            and(
              eq(scheduleOverrides.scheduleId, scheduleId),
              inArray(
                scheduleOverrides.occurrenceDate,
                obsoleteOccurrenceDates,
              ),
            ),
          )
      }
    }

    const responseRevision =
      input.effectiveFrom === undefined
        ? updatedSeries.revisions[0]
        : getScheduleRevisionForDate(
            updatedSeries.revisions,
            input.effectiveFrom,
          )
    if (!responseRevision) {
      return { kind: 'invalid', message: 'Schedule has no revisions' }
    }

    return { kind: 'updated', series: updatedSeries, responseRevision }
  })
}

export async function deleteScheduleSeries(scheduleId: string) {
  return db.transaction(async (tx) => {
    const schedule = await tx.query.schedules.findFirst({
      where: eq(schedules.id, scheduleId),
    })
    if (!schedule) return false

    const revisions = await tx
      .select()
      .from(scheduleRevisions)
      .where(eq(scheduleRevisions.scheduleId, scheduleId))
    const recurrenceRuleIds = [
      ...new Set(
        revisions
          .map((revision) => revision.recurrenceRuleId)
          .filter((id): id is string => id != null),
      ),
    ]

    await tx.delete(schedules).where(eq(schedules.id, scheduleId))
    await deleteUnreferencedRecurrenceRules(tx, recurrenceRuleIds)

    return true
  })
}
