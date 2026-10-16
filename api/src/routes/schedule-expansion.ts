import type {
  recurrenceRules,
  scheduleOverrides,
  scheduleRevisions,
  schedules,
} from '#db/schema'

export type ScheduleOverrideTimes = Pick<
  typeof scheduleOverrides.$inferSelect,
  'startTime' | 'endTime' | 'movedToDate' | 'skipped'
>

export type ScheduleRevisionWithRule = {
  revision: typeof scheduleRevisions.$inferSelect
  rule: typeof recurrenceRules.$inferSelect | null
}

export type ScheduleSeries = {
  schedule: typeof schedules.$inferSelect
  revisions: ScheduleRevisionWithRule[]
}

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

export type ScheduleRecurrenceResponse = {
  id: string
  type: string
  interval: number
  daysOfWeek: number[] | null
  dayOfMonth: number | null
} | null

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

export function recurrenceRuleToResponse(
  rule: typeof recurrenceRules.$inferSelect | null,
): ScheduleRecurrenceResponse {
  if (!rule) return null
  return {
    id: rule.id,
    type: rule.type,
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
  }
}

export function getScheduleRevisionForDate(
  revisions: readonly ScheduleRevisionWithRule[],
  dateStr: string,
): ScheduleRevisionWithRule | undefined {
  let activeRevision: ScheduleRevisionWithRule | undefined

  for (const revision of revisions) {
    if (revision.revision.effectiveFrom > dateStr) break
    activeRevision = revision
  }

  return activeRevision
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
  series: ScheduleSeries,
  date: Date,
): boolean {
  const dateStr = formatDateStr(date)
  const { schedule, revisions } = series
  const firstRevision = revisions[0]

  if (!firstRevision || dateStr < firstRevision.revision.effectiveFrom) {
    return false
  }
  if (schedule.endDate != null && dateStr > schedule.endDate) return false

  const activeRevision = getScheduleRevisionForDate(revisions, dateStr)
  if (!activeRevision) return false
  if (!activeRevision.rule) {
    return dateStr === activeRevision.revision.effectiveFrom
  }

  return matchesDate(activeRevision.rule, date)
}

/**
 * Expand a schedule for a given date, handling cross-midnight schedules.
 *
 * Cross-midnight example: startTime=23:00, endTime=07:00
 * - On the start date: 23:00 -> 00:00 (next day)
 * - On the next date: 00:00 -> 07:00
 */
export function expandScheduleForDate(
  series: ScheduleSeries,
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
  const { schedule, revisions } = series
  const firstRevision = revisions[0]
  if (!firstRevision) return []

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

  for (const occurrence of getScheduleOccurrencesStartingOnDate(
    series,
    dateStr,
    overrides,
  )) {
    const isCrossMidnight = occurrence.startTime > occurrence.endTime
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    blocks.push({
      scheduleId: schedule.id,
      title: schedule.title,
      startDate: firstRevision.revision.effectiveFrom,
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
  for (const occurrence of getScheduleOccurrencesStartingOnDate(
    series,
    prevDateStr,
    overrides,
  )) {
    if (occurrence.startTime <= occurrence.endTime) continue

    blocks.push({
      scheduleId: schedule.id,
      title: schedule.title,
      startDate: firstRevision.revision.effectiveFrom,
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

export function getScheduleOccurrencesStartingOnDate(
  series: ScheduleSeries,
  dateStr: string,
  overrides: ScheduleOverrideIndex = emptyScheduleOverrideIndex,
): ScheduleOccurrence[] {
  const date = new Date(`${dateStr}T00:00:00`)
  const candidates: Array<{
    occurrenceDate: string
    revision: ScheduleRevisionWithRule
    override: ScheduleOverrideTimes | undefined
  }> = []
  const override = overrides.byOccurrenceDate.get(dateStr)
  const revision = getScheduleRevisionForDate(series.revisions, dateStr)

  if (
    revision &&
    scheduleOccursOnDate(series, date) &&
    override?.movedToDate == null
  ) {
    candidates.push({ occurrenceDate: dateStr, revision, override })
  }

  for (const {
    occurrenceDate,
    override: movedOverride,
  } of overrides.byMovedToDate.get(dateStr) ?? []) {
    if (!scheduleOccursOnDate(series, new Date(`${occurrenceDate}T00:00:00`))) {
      continue
    }

    const movedRevision = getScheduleRevisionForDate(
      series.revisions,
      occurrenceDate,
    )
    if (!movedRevision) continue

    candidates.push({
      occurrenceDate,
      revision: movedRevision,
      override: movedOverride,
    })
  }

  return candidates.flatMap(({ occurrenceDate, revision, override }) => {
    if (override?.skipped === true) return []

    return [
      {
        occurrenceDate,
        startTime: override?.startTime ?? revision.revision.startTime,
        endTime: override?.endTime ?? revision.revision.endTime,
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
