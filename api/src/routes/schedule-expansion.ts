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

type ScheduleRecurrenceRule = typeof recurrenceRules.$inferSelect

export type ScheduleRevisionWithRule = {
  revision: typeof scheduleRevisions.$inferSelect
  rule: ScheduleRecurrenceRule | null
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

export type ScheduleDraft = {
  occurrenceChange?: {
    originalDate: string
    date?: string
    startTime?: string
    endTime?: string
    skipped?: boolean
  }
  revisionChange?: {
    effectiveFrom: string
    startTime?: string
    endTime?: string
    recurrence?: {
      type: ScheduleRecurrenceRule['type']
      interval: number
      daysOfWeek?: number[] | undefined
      dayOfMonth?: number | undefined
    } | null
    mode?: 'from' | 'all' | 'replace'
  }
  endDate?: string | null
}

export type ScheduleDraftOccurrence = {
  date: string
  originalDate: string
  startTime: string
  endTime: string
  skipped: boolean
}

type ScheduleOccurrence = {
  occurrenceDate: string
  startTime: string
  endTime: string
  overridden: 'moved' | 'time' | null
  skipped: boolean
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
  rule: ScheduleRecurrenceRule | null,
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

  for (const occurrence of getOccurrencesStartingOnDate(
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
  for (const occurrence of getOccurrencesStartingOnDate(
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

function applyScheduleDraftToSeries(
  series: ScheduleSeries,
  draft: ScheduleDraft,
): ScheduleSeries {
  const schedule =
    draft.endDate === undefined
      ? series.schedule
      : { ...series.schedule, endDate: draft.endDate }
  const revisionChange = draft.revisionChange
  if (!revisionChange) return { ...series, schedule }

  const applyRevisionChange = (
    current: ScheduleRevisionWithRule,
    effectiveFrom: string,
  ): ScheduleRevisionWithRule => {
    const recurrence = revisionChange.recurrence
    const rule =
      recurrence === undefined
        ? current.rule
        : recurrence === null
          ? null
          : {
              id: current.rule?.id ?? 'draft',
              type: recurrence.type,
              interval: recurrence.interval,
              daysOfWeek: recurrence.daysOfWeek ?? null,
              dayOfMonth: recurrence.dayOfMonth ?? null,
              createdAt: current.rule?.createdAt ?? new Date(0),
              updatedAt: current.rule?.updatedAt ?? new Date(0),
            }

    return {
      revision: {
        ...current.revision,
        effectiveFrom,
        startTime: revisionChange.startTime ?? current.revision.startTime,
        endTime: revisionChange.endTime ?? current.revision.endTime,
        recurrenceRuleId:
          recurrence === null
            ? null
            : recurrence === undefined
              ? current.revision.recurrenceRuleId
              : (rule?.id ?? 'draft'),
      },
      rule,
    }
  }

  if (revisionChange.mode === 'all') {
    return {
      schedule,
      revisions: series.revisions.map((revision) =>
        applyRevisionChange(revision, revision.revision.effectiveFrom),
      ),
    }
  }

  const baseRevision =
    revisionChange.mode === 'replace'
      ? series.revisions[0]
      : getScheduleRevisionForDate(
          series.revisions,
          revisionChange.effectiveFrom,
        )
  if (!baseRevision) return { ...series, schedule }

  const updatedRevision = applyRevisionChange(
    baseRevision,
    revisionChange.effectiveFrom,
  )
  return {
    schedule,
    revisions: [
      ...series.revisions.filter(
        ({ revision }) => revision.effectiveFrom < revisionChange.effectiveFrom,
      ),
      updatedRevision,
    ],
  }
}

export function scheduleOccursOnDateWithDraft(
  series: ScheduleSeries,
  date: Date,
  draft: ScheduleDraft,
): boolean {
  return scheduleOccursOnDate(applyScheduleDraftToSeries(series, draft), date)
}

export function expandScheduleWithDraft({
  series,
  overrides,
  startDate,
  endDate,
  draft,
}: {
  series: ScheduleSeries
  overrides: Array<{ occurrenceDate: string } & ScheduleOverrideTimes>
  startDate: string
  endDate: string
  draft: ScheduleDraft
}): ScheduleDraftOccurrence[] {
  const draftedSeries = applyScheduleDraftToSeries(series, draft)
  const overridesByDate = new Map(
    overrides.map((override) => [override.occurrenceDate, override]),
  )

  if (draft.occurrenceChange) {
    const occurrenceChange = draft.occurrenceChange
    const existing = overridesByDate.get(occurrenceChange.originalDate)
    const skipped = occurrenceChange.skipped ?? existing?.skipped ?? false
    overridesByDate.set(occurrenceChange.originalDate, {
      occurrenceDate: occurrenceChange.originalDate,
      startTime: skipped
        ? null
        : (occurrenceChange.startTime ?? existing?.startTime ?? null),
      endTime: skipped
        ? null
        : (occurrenceChange.endTime ?? existing?.endTime ?? null),
      movedToDate: skipped
        ? null
        : occurrenceChange.date === undefined
          ? (existing?.movedToDate ?? null)
          : occurrenceChange.date === occurrenceChange.originalDate
            ? null
            : occurrenceChange.date,
      skipped,
    })
  }

  const overrideIndex = buildScheduleOverrideIndex(overridesByDate.values())
  const occurrences: ScheduleDraftOccurrence[] = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const endBound = new Date(`${endDate}T00:00:00`)

  while (cursor <= endBound) {
    const date = formatDateStr(cursor)
    for (const occurrence of getOccurrencesStartingOnDate(
      draftedSeries,
      date,
      overrideIndex,
      true,
    )) {
      occurrences.push({
        date,
        originalDate: occurrence.occurrenceDate,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        skipped: occurrence.skipped,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return occurrences.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.originalDate.localeCompare(b.originalDate),
  )
}

function getOccurrencesStartingOnDate(
  series: ScheduleSeries,
  dateStr: string,
  overrides: ScheduleOverrideIndex,
  includeSkipped = false,
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
    const skipped = override?.skipped === true
    if (skipped && !includeSkipped) return []

    return [
      {
        occurrenceDate,
        startTime: override?.startTime ?? revision.revision.startTime,
        endTime: override?.endTime ?? revision.revision.endTime,
        skipped,
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
