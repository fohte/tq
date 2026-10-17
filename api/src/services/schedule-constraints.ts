import { z } from 'zod'

const scheduleConstraintTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

const scheduleConstraintWeekdayPreferenceSchema = z.enum([
  'preferred',
  'if_free',
  'reserve',
  'excluded',
])

const scheduleConstraintWeekdaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  preference: scheduleConstraintWeekdayPreferenceSchema,
})

export const scheduleConstraintSchema = z
  .object({
    weeklyMin: z.number().int().min(0).max(7).nullable(),
    weeklyMax: z.number().int().min(0).max(7).nullable(),
    weeklyTarget: z.number().int().min(0).max(7).nullable(),
    maxConsecutiveDays: z.number().int().min(1).nullable(),
    windowStart: scheduleConstraintTimeSchema.nullable(),
    windowEnd: scheduleConstraintTimeSchema.nullable(),
    weekdays: z.array(scheduleConstraintWeekdaySchema),
  })
  .superRefine((constraint, context) => {
    if (
      constraint.weeklyMin !== null &&
      constraint.weeklyMax !== null &&
      constraint.weeklyMin > constraint.weeklyMax
    ) {
      context.addIssue({
        code: 'custom',
        message: 'weeklyMin must not exceed weeklyMax',
        path: ['weeklyMin'],
      })
    }

    if (
      constraint.weeklyTarget !== null &&
      (constraint.weeklyTarget < (constraint.weeklyMin ?? 0) ||
        constraint.weeklyTarget > (constraint.weeklyMax ?? 7))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'weeklyTarget must be within the weekly count range',
        path: ['weeklyTarget'],
      })
    }

    if ((constraint.windowStart === null) !== (constraint.windowEnd === null)) {
      context.addIssue({
        code: 'custom',
        message: 'windowStart and windowEnd must both be set or both be null',
        path: ['windowEnd'],
      })
    }

    const seenDays = new Set<number>()
    for (const [index, weekday] of constraint.weekdays.entries()) {
      if (seenDays.has(weekday.dayOfWeek)) {
        context.addIssue({
          code: 'custom',
          message: 'A weekday preference can only be specified once',
          path: ['weekdays', index, 'dayOfWeek'],
        })
      }
      seenDays.add(weekday.dayOfWeek)
    }
  })

export type ScheduleConstraint = z.infer<typeof scheduleConstraintSchema>

export type ScheduleConstraintEvaluationRange = {
  startDate: string
  endDate: string
}

export type ScheduleConstraintOccurrence = {
  date: string
  originalDate: string
  startTime: string
  endTime: string
  skipped: boolean
}

export type ScheduleConstraintTimeBlock = {
  date: string
  startTime: string
  endTime: string
}

type ViolationBase = {
  date: string
  originalDate?: string
}

export type ScheduleConstraintViolation =
  | (ViolationBase & {
      type: 'weekly-count-below-minimum'
      severity: 'required'
      weekStart: string
      count: number
      minimum: number
    })
  | (ViolationBase & {
      type: 'weekly-count-above-maximum'
      severity: 'required'
      weekStart: string
      count: number
      maximum: number
    })
  | (ViolationBase & {
      type: 'weekly-target-not-met'
      severity: 'preferred'
      weekStart: string
      count: number
      target: number
    })
  | (ViolationBase & {
      type: 'excluded-weekday'
      severity: 'required'
    })
  | (ViolationBase & {
      type: 'reserve-weekday'
      severity: 'preferred'
    })
  | (ViolationBase & {
      type: 'consecutive-days-exceeded'
      severity: 'required'
      consecutiveDays: number
      maximum: number
      dates: string[]
    })
  | (ViolationBase & {
      type: 'outside-time-window'
      severity: 'required'
      startTime: string
      endTime: string
      windowStart: string
      windowEnd: string
    })
  | (ViolationBase & {
      type: 'if-free-overlap'
      severity: 'required'
      overlap: ScheduleConstraintTimeBlock
    })

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const MINUTES_IN_DAY = 24 * 60

function dateOrdinal(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`) / DAY_IN_MILLISECONDS
}

function dateFromOrdinal(ordinal: number): string {
  return new Date(ordinal * DAY_IN_MILLISECONDS).toISOString().slice(0, 10)
}

function dayOfWeek(date: string): number {
  return new Date(dateOrdinal(date) * DAY_IN_MILLISECONDS).getUTCDay()
}

function weekStart(date: string): string {
  const ordinal = dateOrdinal(date)
  const daysSinceMonday = (dayOfWeek(date) + 6) % 7
  return dateFromOrdinal(ordinal - daysSinceMonday)
}

function timeInMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function movementDetails(occurrence: ScheduleConstraintOccurrence): {
  originalDate?: string
} {
  return occurrence.date === occurrence.originalDate
    ? {}
    : { originalDate: occurrence.originalDate }
}

function occurrenceStart(
  occurrence: Pick<ScheduleConstraintTimeBlock, 'date' | 'startTime'>,
): number {
  return (
    dateOrdinal(occurrence.date) * MINUTES_IN_DAY +
    timeInMinutes(occurrence.startTime)
  )
}

function durationInMinutes(
  occurrence: Pick<ScheduleConstraintTimeBlock, 'startTime' | 'endTime'>,
): number {
  const start = timeInMinutes(occurrence.startTime)
  const end = timeInMinutes(occurrence.endTime)
  return end < start ? end + MINUTES_IN_DAY - start : end - start
}

function occurrenceEnd(
  occurrence: Pick<
    ScheduleConstraintTimeBlock,
    'date' | 'startTime' | 'endTime'
  >,
): number {
  return occurrenceStart(occurrence) + durationInMinutes(occurrence)
}

function overlaps(
  left: ScheduleConstraintTimeBlock,
  right: ScheduleConstraintTimeBlock,
): boolean {
  return (
    occurrenceStart(left) < occurrenceEnd(right) &&
    occurrenceStart(right) < occurrenceEnd(left)
  )
}

function isWithinTimeWindow(
  occurrence: ScheduleConstraintOccurrence,
  windowStart: string,
  windowEnd: string,
): boolean {
  const start = timeInMinutes(occurrence.startTime)
  const duration = durationInMinutes(occurrence)
  const windowStartMinutes = timeInMinutes(windowStart)
  const rawWindowEnd = timeInMinutes(windowEnd)
  const windowEndMinutes =
    rawWindowEnd < windowStartMinutes
      ? rawWindowEnd + MINUTES_IN_DAY
      : rawWindowEnd

  return [-MINUTES_IN_DAY, 0, MINUTES_IN_DAY].some((offset) => {
    const startOfWindow = windowStartMinutes + offset
    return (
      start >= startOfWindow && start + duration <= windowEndMinutes + offset
    )
  })
}

function compareOccurrences(
  left: ScheduleConstraintOccurrence,
  right: ScheduleConstraintOccurrence,
): number {
  return (
    left.date.localeCompare(right.date) ||
    left.originalDate.localeCompare(right.originalDate) ||
    left.startTime.localeCompare(right.startTime)
  )
}

function compareViolations(
  left: ScheduleConstraintViolation,
  right: ScheduleConstraintViolation,
): number {
  return (
    left.date.localeCompare(right.date) ||
    left.type.localeCompare(right.type) ||
    (left.originalDate ?? '').localeCompare(right.originalDate ?? '')
  )
}

function isWithinEvaluationRange(
  date: string,
  range: ScheduleConstraintEvaluationRange,
): boolean {
  return date >= range.startDate && date <= range.endDate
}

function addWeeklyViolations(
  constraint: ScheduleConstraint,
  range: ScheduleConstraintEvaluationRange,
  occurrences: readonly ScheduleConstraintOccurrence[],
  violations: ScheduleConstraintViolation[],
): void {
  const occurrencesByWeek = new Map<string, ScheduleConstraintOccurrence[]>()

  for (const occurrence of occurrences) {
    const start = weekStart(occurrence.date)
    const weekOccurrences = occurrencesByWeek.get(start) ?? []
    weekOccurrences.push(occurrence)
    occurrencesByWeek.set(start, weekOccurrences)
  }

  const lastWeekStartOrdinal = dateOrdinal(weekStart(range.endDate))
  for (
    let weekStartOrdinal = dateOrdinal(weekStart(range.startDate));
    weekStartOrdinal <= lastWeekStartOrdinal;
    weekStartOrdinal += 7
  ) {
    const start = dateFromOrdinal(weekStartOrdinal)
    const weekOccurrences = occurrencesByWeek.get(start) ?? []
    const activeOccurrences = weekOccurrences
      .filter((occurrence) => !occurrence.skipped)
      .sort(compareOccurrences)
    const count = activeOccurrences.length

    if (constraint.weeklyMin !== null && count < constraint.weeklyMin) {
      violations.push({
        type: 'weekly-count-below-minimum',
        severity: 'required',
        date: start,
        weekStart: start,
        count,
        minimum: constraint.weeklyMin,
      })
    } else if (constraint.weeklyMax !== null && count > constraint.weeklyMax) {
      const triggeringOccurrence = activeOccurrences[constraint.weeklyMax]
      violations.push({
        type: 'weekly-count-above-maximum',
        severity: 'required',
        date: triggeringOccurrence?.date ?? start,
        ...(triggeringOccurrence ? movementDetails(triggeringOccurrence) : {}),
        weekStart: start,
        count,
        maximum: constraint.weeklyMax,
      })
    } else if (
      constraint.weeklyTarget !== null &&
      count < constraint.weeklyTarget
    ) {
      violations.push({
        type: 'weekly-target-not-met',
        severity: 'preferred',
        date: start,
        weekStart: start,
        count,
        target: constraint.weeklyTarget,
      })
    }
  }
}

function addConsecutiveDayViolations(
  maximum: number | null,
  range: ScheduleConstraintEvaluationRange,
  occurrences: readonly ScheduleConstraintOccurrence[],
  violations: ScheduleConstraintViolation[],
): void {
  if (maximum === null) return

  const occurrencesByDate = new Map<string, ScheduleConstraintOccurrence[]>()
  for (const occurrence of occurrences) {
    if (occurrence.skipped) continue
    const sameDayOccurrences = occurrencesByDate.get(occurrence.date) ?? []
    sameDayOccurrences.push(occurrence)
    occurrencesByDate.set(occurrence.date, sameDayOccurrences)
  }

  const dates = [...occurrencesByDate.keys()].sort()
  let streak: string[] = []

  const flushStreak = () => {
    if (streak.length <= maximum) return

    const firstExcessDate = streak[maximum]
    if (
      firstExcessDate === undefined ||
      !isWithinEvaluationRange(firstExcessDate, range)
    ) {
      return
    }
    const triggeringOccurrence = occurrencesByDate
      .get(firstExcessDate)
      ?.sort(compareOccurrences)[0]
    if (!triggeringOccurrence) return

    violations.push({
      type: 'consecutive-days-exceeded',
      severity: 'required',
      date: firstExcessDate,
      ...movementDetails(triggeringOccurrence),
      consecutiveDays: streak.length,
      maximum,
      dates: [...streak],
    })
  }

  for (const date of dates) {
    const previousDate = streak.at(-1)
    if (
      previousDate !== undefined &&
      dateOrdinal(date) !== dateOrdinal(previousDate) + 1
    ) {
      flushStreak()
      streak = []
    }
    streak.push(date)
  }
  flushStreak()
}

export function checkScheduleConstraints(
  constraint: ScheduleConstraint,
  range: ScheduleConstraintEvaluationRange,
  occurrences: readonly ScheduleConstraintOccurrence[],
  otherTimeBlocks: readonly ScheduleConstraintTimeBlock[] = [],
): ScheduleConstraintViolation[] {
  const sortedOccurrences = [...occurrences].sort(compareOccurrences)
  const activeOccurrences = sortedOccurrences.filter(
    (occurrence) => !occurrence.skipped,
  )
  const weekdayPreferences = new Map(
    constraint.weekdays.map(({ dayOfWeek: day, preference }) => [
      day,
      preference,
    ]),
  )
  const violations: ScheduleConstraintViolation[] = []

  addWeeklyViolations(constraint, range, sortedOccurrences, violations)
  addConsecutiveDayViolations(
    constraint.maxConsecutiveDays,
    range,
    sortedOccurrences,
    violations,
  )

  for (const occurrence of activeOccurrences) {
    if (!isWithinEvaluationRange(occurrence.date, range)) continue

    const preference = weekdayPreferences.get(dayOfWeek(occurrence.date))
    const movement = movementDetails(occurrence)

    if (preference === 'excluded') {
      violations.push({
        type: 'excluded-weekday',
        severity: 'required',
        date: occurrence.date,
        ...movement,
      })
    } else if (preference === 'reserve') {
      violations.push({
        type: 'reserve-weekday',
        severity: 'preferred',
        date: occurrence.date,
        ...movement,
      })
    }

    if (
      constraint.windowStart !== null &&
      constraint.windowEnd !== null &&
      !isWithinTimeWindow(
        occurrence,
        constraint.windowStart,
        constraint.windowEnd,
      )
    ) {
      violations.push({
        type: 'outside-time-window',
        severity: 'required',
        date: occurrence.date,
        ...movement,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        windowStart: constraint.windowStart,
        windowEnd: constraint.windowEnd,
      })
    }

    if (preference === 'if_free') {
      for (const otherTimeBlock of otherTimeBlocks) {
        if (!overlaps(occurrence, otherTimeBlock)) continue
        violations.push({
          type: 'if-free-overlap',
          severity: 'required',
          date: occurrence.date,
          ...movement,
          overlap: { ...otherTimeBlock },
        })
      }
    }
  }

  return violations.sort(compareViolations)
}
