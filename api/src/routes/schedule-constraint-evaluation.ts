import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import {
  scheduleConstraints,
  scheduleConstraintWeekdays,
  scheduleOverrides,
} from '#db/schema'
import { SCHEDULE_REMINDER_TIME_ZONE } from '#env'
import {
  getEvents,
  partitionAccountEvents,
} from '#integrations/google-calendar/index'
import {
  addCalendarDays,
  enumerateCalendarDates,
  formatDateTimeInTimeZone,
  mondayWeekStart,
} from '#lib/timezone'
import {
  expandScheduleForDate,
  expandScheduleWithDraft,
  formatDateStr,
  type ScheduleDraft,
  type ScheduleSeries,
} from '#routes/schedule-expansion'
import { buildSchedulePreviewRange } from '#routes/schedule-preview'
import {
  loadScheduleOverridesForExpansion,
  loadSchedulesWithRules,
} from '#routes/schedule-shared'
import type { ScheduleConstraintDraft } from '#schemas/schedule-constraint-check'
import {
  checkScheduleConstraints,
  normalizeScheduleConstraint,
  type ScheduleConstraintEvaluationRange,
  type ScheduleConstraintOccurrence,
  scheduleConstraintSchema,
  type ScheduleConstraintTimeBlock,
  type ScheduleConstraintViolation,
} from '#services/schedule-constraints'

export function scheduleConstraintWeekRange(
  date: string,
): ScheduleConstraintEvaluationRange {
  const startDate = mondayWeekStart(date)
  return { startDate, endDate: addCalendarDays(startDate, 6) }
}

export async function loadScheduleConstraint(scheduleId: string) {
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
  if (parsed.success) return normalizeScheduleConstraint(parsed.data)

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

  return enumerateCalendarDates(startDate, endDate).flatMap((date) =>
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

  const formatTimedDateTime = (value: string) => {
    const instant = new Date(value)
    return Number.isNaN(instant.getTime())
      ? null
      : formatDateTimeInTimeZone(instant, SCHEDULE_REMINDER_TIME_ZONE)
  }
  const start = event.isAllDay
    ? { date: event.startTime.slice(0, 10), time: '00:00' }
    : formatTimedDateTime(event.startTime)
  const end = event.isAllDay
    ? { date: event.endTime.slice(0, 10), time: '24:00' }
    : formatTimedDateTime(event.endTime)
  if (start === null || end === null) return []
  const { date: startDate, time: startTime } = start
  const { date: endDate, time: endTime } = end
  if (startTime.length !== 5 || endTime.length !== 5 || endDate < startDate) {
    return []
  }

  if (event.isAllDay) {
    return enumerateCalendarDates(startDate, addCalendarDays(endDate, -1)).map(
      (date) => ({
        date,
        startTime: '00:00',
        endTime: '24:00',
      }),
    )
  }

  if (startDate === endDate) return [{ date: startDate, startTime, endTime }]

  const blocks: ScheduleConstraintTimeBlock[] = []
  for (const date of enumerateCalendarDates(
    startDate,
    addCalendarDays(endDate, -1),
  )) {
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
): Promise<{
  timeBlocks: ScheduleConstraintTimeBlock[]
  incomplete: boolean
}> {
  const timeMin = `${addCalendarDays(startDate, -2)}T00:00:00.000Z`
  const timeMax = `${addCalendarDays(endDate, 3)}T00:00:00.000Z`
  const accounts = await getEvents(timeMin, timeMax)
  const { events, successCount } = partitionAccountEvents(
    accounts,
    (accountId, error) => {
      captureWithFingerprint(
        error,
        'api.schedule.constraints.calendar-failed',
        { extras: { accountId } },
      )
    },
  )

  return {
    timeBlocks: events.flatMap(googleEventTimeBlocks),
    incomplete: accounts.length > 0 && successCount !== accounts.length,
  }
}

function expansionRange(
  range: ScheduleConstraintEvaluationRange,
  maximumConsecutiveDays: number | null,
): ScheduleConstraintEvaluationRange {
  const firstWeek = mondayWeekStart(range.startDate)
  const lastWeek = addCalendarDays(mondayWeekStart(range.endDate), 6)
  const padding = maximumConsecutiveDays ?? 0
  return {
    startDate: addCalendarDays(firstWeek, -padding),
    endDate: addCalendarDays(lastWeek, padding),
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

type ScheduleConstraintEvaluationResult = {
  constraintViolations: ScheduleConstraintViolation[]
  calendarDataIncomplete?: true
  constraintEvaluationIncomplete?: true
}

export async function evaluateScheduleConstraintViolations({
  series,
  range,
  draft,
}: {
  series: ScheduleSeries
  range: ScheduleConstraintEvaluationRange
  draft?: ScheduleConstraintDraft
}): Promise<ScheduleConstraintEvaluationResult> {
  const constraint =
    draft?.constraints === undefined
      ? await loadScheduleConstraint(series.schedule.id)
      : draft.constraints
  if (!constraint) return { constraintViolations: [] }

  const occurrenceRange = expansionRange(range, constraint.maxConsecutiveDays)
  const needsTimeBlocks = constraint.weekdays.some(
    ({ preference }) => preference === 'if_free',
  )
  const timeBlockRange = {
    startDate: addCalendarDays(occurrenceRange.startDate, -1),
    endDate: addCalendarDays(occurrenceRange.endDate, 1),
  }
  const [overrides, scheduleTimeBlocks, googleCalendar] = await Promise.all([
    db
      .select()
      .from(scheduleOverrides)
      .where(eq(scheduleOverrides.scheduleId, series.schedule.id)),
    needsTimeBlocks
      ? loadOtherScheduleTimeBlocks(
          series.schedule.id,
          timeBlockRange.startDate,
          timeBlockRange.endDate,
        )
      : Promise.resolve([]),
    needsTimeBlocks
      ? loadGoogleCalendarTimeBlocks(
          timeBlockRange.startDate,
          timeBlockRange.endDate,
        )
      : Promise.resolve({ timeBlocks: [], incomplete: false }),
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

  return {
    constraintViolations: checkScheduleConstraints(
      constraint,
      range,
      occurrences,
      [...scheduleTimeBlocks, ...googleCalendar.timeBlocks],
    ),
    ...(googleCalendar.incomplete ? { calendarDataIncomplete: true } : {}),
  }
}

export async function evaluateScheduleConstraintViolationsSafely(
  args: Parameters<typeof evaluateScheduleConstraintViolations>[0],
): Promise<ScheduleConstraintEvaluationResult> {
  const result = await ResultAsync.fromPromise(
    evaluateScheduleConstraintViolations(args),
    (error) => error,
  )
  return result.match(
    (value) => value,
    (error) => {
      captureWithFingerprint(
        error,
        'api.schedule.constraints.evaluation-failed',
        { extras: { scheduleId: args.series.schedule.id } },
      )
      return {
        constraintViolations: [],
        constraintEvaluationIncomplete: true as const,
      }
    },
  )
}

export async function evaluateSavedScheduleConstraintViolations(
  series: ScheduleSeries,
  effectiveFrom?: string,
): Promise<ScheduleConstraintEvaluationResult> {
  const today = formatDateStr(new Date())
  const requestedStart =
    effectiveFrom != null && effectiveFrom > today ? effectiveFrom : undefined
  const range = buildSchedulePreviewRange(series, requestedStart)
  const endDate =
    series.schedule.endDate == null || series.schedule.endDate > range.endDate
      ? range.endDate
      : series.schedule.endDate

  return endDate < range.startDate
    ? { constraintViolations: [] }
    : evaluateScheduleConstraintViolationsSafely({
        series,
        range: { startDate: range.startDate, endDate },
      })
}
