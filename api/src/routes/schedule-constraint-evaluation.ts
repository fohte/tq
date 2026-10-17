import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'

import { db } from '#db/connection'
import {
  scheduleConstraints,
  scheduleConstraintWeekdays,
  scheduleOverrides,
} from '#db/schema'
import {
  getEvents,
  partitionAccountEvents,
} from '#integrations/google-calendar/index'
import {
  expandScheduleForDate,
  expandScheduleWithDraft,
  formatDateStr,
  type ScheduleDraft,
  type ScheduleSeries,
} from '#routes/schedule-expansion'
import {
  loadScheduleOverridesForExpansion,
  loadSchedulesWithRules,
} from '#routes/schedule-shared'
import type { ScheduleConstraintDraft } from '#schemas/schedule-constraint-check'
import {
  checkScheduleConstraints,
  type ScheduleConstraintEvaluationRange,
  type ScheduleConstraintOccurrence,
  scheduleConstraintSchema,
  type ScheduleConstraintTimeBlock,
  type ScheduleConstraintViolation,
} from '#services/schedule-constraints'

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + days)
  return formatDateStr(value)
}

function mondayOnOrBefore(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7))
  return formatDateStr(value)
}

export function scheduleConstraintWeekRange(
  date: string,
): ScheduleConstraintEvaluationRange {
  const startDate = mondayOnOrBefore(date)
  return { startDate, endDate: addDays(startDate, 6) }
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = Date.parse(`${startDate}T00:00:00.000Z`)
  const end = Date.parse(`${endDate}T00:00:00.000Z`)

  for (let day = start; day <= end; day += DAY_IN_MILLISECONDS) {
    dates.push(new Date(day).toISOString().slice(0, 10))
  }
  return dates
}

async function loadScheduleConstraint(scheduleId: string) {
  const [row] = await db
    .select()
    .from(scheduleConstraints)
    .where(eq(scheduleConstraints.scheduleId, scheduleId))
    .limit(1)
  if (!row) return null

  const weekdays = await db
    .select({
      dayOfWeek: scheduleConstraintWeekdays.dayOfWeek,
      preference: scheduleConstraintWeekdays.preference,
    })
    .from(scheduleConstraintWeekdays)
    .where(eq(scheduleConstraintWeekdays.scheduleId, scheduleId))
    .orderBy(scheduleConstraintWeekdays.dayOfWeek)

  const parsed = scheduleConstraintSchema.safeParse({
    weeklyMin: row.weeklyMin,
    weeklyMax: row.weeklyMax,
    weeklyTarget: row.weeklyTarget,
    maxConsecutiveDays: row.maxConsecutiveDays,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    weekdays,
  })
  if (parsed.success) return parsed.data

  captureWithFingerprint(
    parsed.error,
    'api.schedule.constraints.invalid-data',
    { extras: { scheduleId } },
  )
  return null
}

async function loadOtherScheduleTimeBlocks(
  scheduleId: string,
  startDate: string,
  endDate: string,
): Promise<ScheduleConstraintTimeBlock[]> {
  const [series, overridesBySchedule] = await Promise.all([
    loadSchedulesWithRules(),
    loadScheduleOverridesForExpansion(startDate, endDate),
  ])
  const otherSeries = series.filter(
    ({ schedule }) => schedule.id !== scheduleId,
  )

  return enumerateDates(startDate, endDate).flatMap((date) =>
    otherSeries.flatMap((other) =>
      expandScheduleForDate(
        other,
        date,
        overridesBySchedule.get(other.schedule.id),
      ).map((block) => ({
        date: block.start.slice(0, 10),
        startTime: block.start.slice(11, 16),
        endTime: block.end.slice(11, 16),
      })),
    ),
  )
}

function googleEventTimeBlocks(event: {
  busy: boolean
  isAllDay: boolean
  startTime: string
  endTime: string
}): ScheduleConstraintTimeBlock[] {
  if (!event.busy || event.startTime.length < 10 || event.endTime.length < 10) {
    return []
  }

  const startDate = event.startTime.slice(0, 10)
  const endDate = event.endTime.slice(0, 10)
  const startTime = event.isAllDay ? '00:00' : event.startTime.slice(11, 16)
  const endTime = event.isAllDay ? '24:00' : event.endTime.slice(11, 16)
  if (startTime.length !== 5 || endTime.length !== 5 || endDate < startDate) {
    return []
  }

  if (event.isAllDay) {
    return enumerateDates(startDate, addDays(endDate, -1)).map((date) => ({
      date,
      startTime: '00:00',
      endTime: '24:00',
    }))
  }

  if (startDate === endDate) return [{ date: startDate, startTime, endTime }]

  const blocks: ScheduleConstraintTimeBlock[] = []
  for (const date of enumerateDates(startDate, addDays(endDate, -1))) {
    blocks.push({
      date,
      startTime: date === startDate ? startTime : '00:00',
      endTime: '24:00',
    })
  }
  if (endTime !== '00:00') {
    blocks.push({ date: endDate, startTime: '00:00', endTime })
  }
  return blocks
}

async function loadGoogleCalendarTimeBlocks(
  startDate: string,
  endDate: string,
): Promise<ScheduleConstraintTimeBlock[]> {
  const timeMin = `${addDays(startDate, -2)}T00:00:00.000Z`
  const timeMax = `${addDays(endDate, 3)}T00:00:00.000Z`
  const accounts = await getEvents(timeMin, timeMax)
  const { events } = partitionAccountEvents(accounts, (accountId, error) => {
    captureWithFingerprint(error, 'api.schedule.constraints.calendar-failed', {
      extras: { accountId },
    })
  })

  return events.flatMap(googleEventTimeBlocks)
}

function expansionRange(
  range: ScheduleConstraintEvaluationRange,
  maximumConsecutiveDays: number | null,
): ScheduleConstraintEvaluationRange {
  const firstWeek = mondayOnOrBefore(range.startDate)
  const lastWeek = addDays(mondayOnOrBefore(range.endDate), 6)
  const padding = maximumConsecutiveDays ?? 0
  return {
    startDate: addDays(firstWeek, -padding),
    endDate: addDays(lastWeek, padding),
  }
}

function toScheduleDraft(
  draft: ScheduleConstraintDraft | undefined,
): ScheduleDraft {
  if (draft === undefined) return {}

  return {
    ...(draft.occurrenceChange === undefined
      ? {}
      : {
          occurrenceChange: {
            originalDate: draft.occurrenceChange.originalDate,
            ...(draft.occurrenceChange.date === undefined
              ? {}
              : { date: draft.occurrenceChange.date }),
            ...(draft.occurrenceChange.startTime === undefined
              ? {}
              : { startTime: draft.occurrenceChange.startTime }),
            ...(draft.occurrenceChange.endTime === undefined
              ? {}
              : { endTime: draft.occurrenceChange.endTime }),
            ...(draft.occurrenceChange.skipped === undefined
              ? {}
              : { skipped: draft.occurrenceChange.skipped }),
          },
        }),
    ...(draft.revisionChange === undefined
      ? {}
      : {
          revisionChange: {
            effectiveFrom: draft.revisionChange.effectiveFrom,
            ...(draft.revisionChange.startTime === undefined
              ? {}
              : { startTime: draft.revisionChange.startTime }),
            ...(draft.revisionChange.endTime === undefined
              ? {}
              : { endTime: draft.revisionChange.endTime }),
            ...(draft.revisionChange.recurrence === undefined
              ? {}
              : { recurrence: draft.revisionChange.recurrence }),
          },
        }),
    ...(draft.endDate === undefined ? {} : { endDate: draft.endDate }),
  }
}

export async function evaluateScheduleConstraintViolations({
  series,
  range,
  draft,
}: {
  series: ScheduleSeries
  range: ScheduleConstraintEvaluationRange
  draft?: ScheduleConstraintDraft
}): Promise<ScheduleConstraintViolation[]> {
  const constraint =
    draft?.constraints === undefined
      ? await loadScheduleConstraint(series.schedule.id)
      : draft.constraints
  if (!constraint) return []

  const occurrenceRange = expansionRange(range, constraint.maxConsecutiveDays)
  const timeBlockRange = {
    startDate: addDays(occurrenceRange.startDate, -1),
    endDate: addDays(occurrenceRange.endDate, 1),
  }
  const [overrides, scheduleTimeBlocks, googleTimeBlocks] = await Promise.all([
    db
      .select()
      .from(scheduleOverrides)
      .where(eq(scheduleOverrides.scheduleId, series.schedule.id)),
    loadOtherScheduleTimeBlocks(
      series.schedule.id,
      timeBlockRange.startDate,
      timeBlockRange.endDate,
    ),
    loadGoogleCalendarTimeBlocks(
      timeBlockRange.startDate,
      timeBlockRange.endDate,
    ),
  ])

  const scheduleDraft = toScheduleDraft(draft)
  const occurrences = expandScheduleWithDraft({
    series,
    overrides,
    startDate: occurrenceRange.startDate,
    endDate: occurrenceRange.endDate,
    draft: scheduleDraft,
    ...(draft?.revisionMode === undefined
      ? {}
      : { revisionMode: draft.revisionMode }),
  }) satisfies ScheduleConstraintOccurrence[]

  return checkScheduleConstraints(constraint, range, occurrences, [
    ...scheduleTimeBlocks,
    ...googleTimeBlocks,
  ])
}
