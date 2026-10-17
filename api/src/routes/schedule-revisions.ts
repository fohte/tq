import { and, eq, gt, inArray } from 'drizzle-orm'
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
  type ScheduleDraft,
  type ScheduleRevisionWithRule,
  type ScheduleSeries,
} from '#routes/schedule-expansion'
import {
  buildScheduleChangePreview,
  buildSchedulePreviewRange,
  getDeletedScheduleOverrides,
  type ScheduleChangePreview,
} from '#routes/schedule-preview'
import {
  buildScheduleSeries,
  loadScheduleWithRevisions,
  uniqueRecurrenceRuleIds,
} from '#routes/schedule-shared'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'
import { createScheduleSchema, updateScheduleSchema } from '#schemas/schedule'

type RecurrenceInput = z.infer<typeof recurrenceRuleSchema>
type CreateScheduleInput = z.infer<typeof createScheduleSchema>
type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>

export type UpdateScheduleSeriesResult =
  | { kind: 'missing' }
  | { kind: 'invalid'; message: string }
  | { kind: 'dryRun'; preview: ScheduleChangePreview }
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

async function resolveRecurrenceRuleId(
  tx: DbTransaction,
  recurrence: RecurrenceInput | null | undefined,
  currentRecurrenceRuleId: string | null,
): Promise<string | null> {
  if (recurrence === undefined) return currentRecurrenceRuleId
  if (recurrence === null) return null
  return (await createRecurrenceRule(tx, recurrence)).id
}

async function updateRevisionFromEffectiveDate(
  tx: DbTransaction,
  scheduleId: string,
  effectiveFrom: string,
  activeRevision: ScheduleRevisionWithRule,
  input: UpdateScheduleInput,
  now: Date,
) {
  const recurrenceRuleId = await resolveRecurrenceRuleId(
    tx,
    input.recurrence,
    activeRevision.revision.recurrenceRuleId,
  )
  const revisionValues = {
    startTime: input.startTime ?? activeRevision.revision.startTime,
    endTime: input.endTime ?? activeRevision.revision.endTime,
    recurrenceRuleId,
  }

  const laterRevisions = await tx
    .delete(scheduleRevisions)
    .where(
      and(
        eq(scheduleRevisions.scheduleId, scheduleId),
        gt(scheduleRevisions.effectiveFrom, effectiveFrom),
      ),
    )
    .returning()

  await tx
    .insert(scheduleRevisions)
    .values({ scheduleId, effectiveFrom, ...revisionValues })
    .onConflictDoUpdate({
      target: [scheduleRevisions.scheduleId, scheduleRevisions.effectiveFrom],
      set: { ...revisionValues, updatedAt: now },
    })

  await deleteUnreferencedRecurrenceRules(tx, [
    ...uniqueRecurrenceRuleIds(laterRevisions),
    ...(activeRevision.revision.recurrenceRuleId != null &&
    activeRevision.revision.recurrenceRuleId !== recurrenceRuleId
      ? [activeRevision.revision.recurrenceRuleId]
      : []),
  ])
}

async function replaceAllScheduleRevisions(
  tx: DbTransaction,
  scheduleId: string,
  series: ScheduleSeries,
  firstRevision: ScheduleRevisionWithRule,
  firstDate: string,
  input: UpdateScheduleInput,
  now: Date,
) {
  const recurrenceRuleId = await resolveRecurrenceRuleId(
    tx,
    input.recurrence,
    firstRevision.revision.recurrenceRuleId,
  )

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
    uniqueRecurrenceRuleIds(
      series.revisions.map(({ revision }) => revision),
    ).filter((id) => id !== recurrenceRuleId),
  )
}

async function updateAllScheduleRevisions(
  tx: DbTransaction,
  scheduleId: string,
  series: ScheduleSeries,
  firstRevision: ScheduleRevisionWithRule,
  input: UpdateScheduleInput,
  now: Date,
) {
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
    revisionUpdates.recurrenceRuleId = await resolveRecurrenceRuleId(
      tx,
      input.recurrence,
      firstRevision.revision.recurrenceRuleId,
    )
  }

  await tx
    .update(scheduleRevisions)
    .set(revisionUpdates)
    .where(eq(scheduleRevisions.scheduleId, scheduleId))
  if (input.recurrence !== undefined) {
    await deleteUnreferencedRecurrenceRules(
      tx,
      uniqueRecurrenceRuleIds(series.revisions.map(({ revision }) => revision)),
    )
  }
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
          remindBeforeMinutes: input.remindBeforeMinutes ?? null,
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
    const series = await loadScheduleWithRevisions(scheduleId, tx)
    if (!series) return { kind: 'missing' }
    const schedule = series.schedule
    const firstRevision = series.revisions[0]
    if (!firstRevision) {
      return { kind: 'invalid', message: 'Schedule has no revisions' }
    }

    const originalFirstDate = firstRevision.revision.effectiveFrom
    const firstDate = input.startDate ?? originalFirstDate
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
      (input.startDate !== undefined &&
        input.startDate !== firstRevision.revision.effectiveFrom) ||
      input.recurrence === null
    const revisionMode =
      input.effectiveFrom !== undefined
        ? 'from'
        : shouldReplaceAllRevisions
          ? 'replace'
          : 'all'
    const activeRevision =
      input.effectiveFrom === undefined
        ? undefined
        : getScheduleRevisionForDate(series.revisions, input.effectiveFrom)
    if (input.effectiveFrom !== undefined && !activeRevision) {
      return {
        kind: 'invalid',
        message: 'effectiveFrom must be on or after the schedule start date',
      }
    }
    if (
      input.effectiveFrom !== undefined &&
      hasRevisionChanges &&
      input.recurrence === undefined &&
      activeRevision != null &&
      activeRevision.revision.recurrenceRuleId == null &&
      input.effectiveFrom !== activeRevision.revision.effectiveFrom
    ) {
      return {
        kind: 'invalid',
        message: 'effectiveFrom must match the date of a one-off schedule',
      }
    }

    const needsRevisionDraft =
      hasRevisionChanges ||
      (input.effectiveFrom === undefined && shouldReplaceAllRevisions)
    const draft: ScheduleDraft = {
      ...(needsRevisionDraft
        ? {
            revisionChange: {
              effectiveFrom: input.effectiveFrom ?? firstDate,
              ...(input.startTime !== undefined
                ? { startTime: input.startTime }
                : {}),
              ...(input.endTime !== undefined
                ? { endTime: input.endTime }
                : {}),
              ...(input.recurrence !== undefined
                ? { recurrence: input.recurrence }
                : {}),
            },
          }
        : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    }
    const shouldLoadOverrides =
      input.dryRun === true ||
      input.endDate != null ||
      (input.effectiveFrom !== undefined && hasRevisionChanges)
    const existingOverrides = shouldLoadOverrides
      ? await tx
          .select()
          .from(scheduleOverrides)
          .where(eq(scheduleOverrides.scheduleId, scheduleId))
      : []
    const deletedOverrides = getDeletedScheduleOverrides(
      series,
      existingOverrides,
      draft,
      revisionMode,
    )

    if (input.dryRun === true) {
      const previewStartDate =
        shouldReplaceAllRevisions && input.startDate !== undefined
          ? input.startDate < originalFirstDate
            ? input.startDate
            : originalFirstDate
          : (input.effectiveFrom ?? input.startDate)
      const range = buildSchedulePreviewRange(series, previewStartDate)
      return {
        kind: 'dryRun',
        preview: buildScheduleChangePreview(
          series,
          existingOverrides,
          range,
          draft,
          deletedOverrides,
          revisionMode,
        ),
      }
    }

    if (input.effectiveFrom !== undefined) {
      if (hasRevisionChanges && activeRevision != null) {
        await updateRevisionFromEffectiveDate(
          tx,
          scheduleId,
          input.effectiveFrom,
          activeRevision,
          input,
          now,
        )
      }
    } else if (shouldReplaceAllRevisions) {
      await replaceAllScheduleRevisions(
        tx,
        scheduleId,
        series,
        firstRevision,
        firstDate,
        input,
        now,
      )
    } else if (hasRevisionChanges) {
      await updateAllScheduleRevisions(
        tx,
        scheduleId,
        series,
        firstRevision,
        input,
        now,
      )
    }

    const updatedSchedule = firstOrThrow(
      await tx
        .update(schedules)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.remindBeforeMinutes !== undefined
            ? { remindBeforeMinutes: input.remindBeforeMinutes }
            : {}),
          ...(input.context !== undefined
            ? { context: input.context ?? 'personal' }
            : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          updatedAt: now,
        })
        .where(eq(schedules.id, scheduleId))
        .returning(),
    )
    const updatedSeries = await loadScheduleWithRevisions(
      updatedSchedule.id,
      tx,
    )
    if (!updatedSeries) return { kind: 'missing' }

    const deletedOccurrenceDates = deletedOverrides.map(
      ({ occurrenceDate }) => occurrenceDate,
    )
    if (deletedOccurrenceDates.length > 0) {
      await tx
        .delete(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.scheduleId, scheduleId),
            inArray(scheduleOverrides.occurrenceDate, deletedOccurrenceDates),
          ),
        )
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
    const recurrenceRuleIds = uniqueRecurrenceRuleIds(revisions)

    await tx.delete(schedules).where(eq(schedules.id, scheduleId))
    await deleteUnreferencedRecurrenceRules(tx, recurrenceRuleIds)

    return true
  })
}
