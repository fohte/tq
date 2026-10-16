import type { recurrenceRules, scheduleOverrides, schedules } from '#db/schema'

export type ScheduleOverrideTimes = Pick<
  typeof scheduleOverrides.$inferSelect,
  'startTime' | 'endTime' | 'movedToDate' | 'skipped'
>

export type ScheduleOverrideIndex = {
  byOccurrenceDate: ReadonlyMap<string, ScheduleOverrideTimes>
  byMovedToDate: ReadonlyMap<
    string,
    ReadonlyArray<{
      occurrenceDate: string
      override: ScheduleOverrideTimes
    }>
  >
}

type ScheduleOccurrence = {
  occurrenceDate: string
  startTime: string
  endTime: string
  overridden: 'moved' | 'time' | null
}

const emptyScheduleOverrideIndex: ScheduleOverrideIndex = {
  byOccurrenceDate: new Map(),
  byMovedToDate: new Map(),
}

export function buildScheduleOverrideIndex(
  entries: Iterable<{ occurrenceDate: string } & ScheduleOverrideTimes>,
): ScheduleOverrideIndex {
  const byOccurrenceDate = new Map<string, ScheduleOverrideTimes>()
  const byMovedToDate = new Map<
    string,
    Array<{ occurrenceDate: string; override: ScheduleOverrideTimes }>
  >()

  for (const entry of entries) {
    byOccurrenceDate.set(entry.occurrenceDate, entry)
    if (entry.movedToDate == null) continue

    const movedOverrides = byMovedToDate.get(entry.movedToDate) ?? []
    movedOverrides.push({
      occurrenceDate: entry.occurrenceDate,
      override: entry,
    })
    byMovedToDate.set(entry.movedToDate, movedOverrides)
  }

  return { byOccurrenceDate, byMovedToDate }
}

/** Check if a date matches the recurrence rule's pattern.
 * - daily: matches every day (interval not yet implemented)
 * - weekly: matches if the date's day-of-week is in daysOfWeek
 * - monthly: matches if the date's day-of-month equals dayOfMonth
 */
function matchesDate(rule: typeof recurrenceRules.$inferSelect, date: Date) {
  switch (rule.type) {
    case 'daily':
      return true
    case 'weekly': {
      if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return false
      return rule.daysOfWeek.includes(date.getDay())
    }
    case 'monthly': {
      if (rule.dayOfMonth == null) return false
      return date.getDate() === rule.dayOfMonth
    }
    case 'custom':
      return true
    default:
      return true
  }
}

export function scheduleOccursOnDate(
  schedule: typeof schedules.$inferSelect,
  rule: typeof recurrenceRules.$inferSelect | null,
  date: Date,
): boolean {
  const dateStr = formatDateStr(date)
  if (dateStr < schedule.startDate) return false
  if (!rule) return dateStr === schedule.startDate
  return matchesDate(rule, date)
}

/**
 * Expand a schedule for a given date, handling cross-midnight schedules.
 *
 * Cross-midnight example: startTime=23:00, endTime=07:00
 * - On the start date: 23:00 -> 00:00 (next day)
 * - On the next date: 00:00 -> 07:00
 */
export function expandScheduleForDate(
  schedule: typeof schedules.$inferSelect,
  rule: typeof recurrenceRules.$inferSelect | null,
  dateStr: string,
  overrides: ScheduleOverrideIndex = emptyScheduleOverrideIndex,
): Array<{
  scheduleId: string
  title: string
  startDate: string
  start: string
  end: string
  context: string
  color: string | null
  occurrenceDate: string
  overridden: 'moved' | 'time' | null
}> {
  const date = new Date(dateStr + 'T00:00:00')

  const blocks: Array<{
    scheduleId: string
    title: string
    startDate: string
    start: string
    end: string
    context: string
    color: string | null
    occurrenceDate: string
    overridden: 'moved' | 'time' | null
  }> = []

  for (const occurrence of getOccurrencesStartingOnDate(
    schedule,
    rule,
    dateStr,
    overrides,
  )) {
    const isCrossMidnight = occurrence.startTime > occurrence.endTime
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    blocks.push({
      scheduleId: schedule.id,
      title: schedule.title,
      startDate: schedule.startDate,
      start: `${dateStr}T${occurrence.startTime}:00`,
      end: isCrossMidnight
        ? `${formatDateStr(nextDate)}T00:00:00`
        : `${dateStr}T${occurrence.endTime}:00`,
      context: schedule.context,
      color: schedule.color,
      occurrenceDate: occurrence.occurrenceDate,
      overridden: occurrence.overridden,
    })
  }

  // Check whether the previous occurrence continues into this date.
  const prevDate = new Date(date)
  prevDate.setDate(prevDate.getDate() - 1)
  const prevDateStr = formatDateStr(prevDate)
  for (const occurrence of getOccurrencesStartingOnDate(
    schedule,
    rule,
    prevDateStr,
    overrides,
  )) {
    if (occurrence.startTime <= occurrence.endTime) continue

    blocks.push({
      scheduleId: schedule.id,
      title: schedule.title,
      startDate: schedule.startDate,
      start: `${dateStr}T00:00:00`,
      end: `${dateStr}T${occurrence.endTime}:00`,
      context: schedule.context,
      color: schedule.color,
      occurrenceDate: occurrence.occurrenceDate,
      overridden: occurrence.overridden,
    })
  }

  return blocks
}

function getOccurrencesStartingOnDate(
  schedule: typeof schedules.$inferSelect,
  rule: typeof recurrenceRules.$inferSelect | null,
  dateStr: string,
  overrides: ScheduleOverrideIndex,
): ScheduleOccurrence[] {
  const date = new Date(`${dateStr}T00:00:00`)
  const candidates: Array<{
    occurrenceDate: string
    override: ScheduleOverrideTimes | undefined
  }> = []
  const override = overrides.byOccurrenceDate.get(dateStr)

  if (
    scheduleOccursOnDate(schedule, rule, date) &&
    override?.movedToDate == null
  ) {
    candidates.push({ occurrenceDate: dateStr, override })
  }

  for (const {
    occurrenceDate,
    override: movedOverride,
  } of overrides.byMovedToDate.get(dateStr) ?? []) {
    if (
      !scheduleOccursOnDate(
        schedule,
        rule,
        new Date(`${occurrenceDate}T00:00:00`),
      )
    ) {
      continue
    }

    candidates.push({ occurrenceDate, override: movedOverride })
  }

  return candidates.flatMap(({ occurrenceDate, override }) => {
    if (override?.skipped === true) return []

    return [
      {
        occurrenceDate,
        startTime: override?.startTime ?? schedule.startTime,
        endTime: override?.endTime ?? schedule.endTime,
        overridden:
          override == null
            ? null
            : override.movedToDate == null
              ? 'time'
              : 'moved',
      },
    ]
  })
}

export function formatDateStr(date: Date): string {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
