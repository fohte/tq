import type { recurrenceRules } from '#db/schema'
import {
  buildScheduleOverrideIndex,
  formatDateStr,
  getOccurrencesStartingOnDate,
  getScheduleRevisionForDate,
  type ScheduleOccurrence,
  scheduleOccursOnDate,
  type ScheduleOverrideTimes,
  type ScheduleRevisionWithRule,
  type ScheduleSeries,
} from '#routes/schedule-expansion-core'

type ScheduleRecurrenceRule = typeof recurrenceRules.$inferSelect

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

type ScheduleRevisionMode = 'from' | 'all' | 'replace'

function applyScheduleDraftToSeries(
  series: ScheduleSeries,
  draft: ScheduleDraft,
  revisionMode: ScheduleRevisionMode = 'from',
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

  if (revisionMode === 'all') {
    return {
      schedule,
      revisions: series.revisions.map((revision) =>
        applyRevisionChange(revision, revision.revision.effectiveFrom),
      ),
    }
  }

  const baseRevision =
    revisionMode === 'replace'
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
  if (revisionMode === 'replace') {
    return { schedule, revisions: [updatedRevision] }
  }

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
  revisionMode = 'from',
}: {
  series: ScheduleSeries
  overrides: Array<{ occurrenceDate: string } & ScheduleOverrideTimes>
  startDate: string
  endDate: string
  draft: ScheduleDraft
  revisionMode?: ScheduleRevisionMode
}): ScheduleDraftOccurrence[] {
  const draftedSeries = applyScheduleDraftToSeries(series, draft, revisionMode)
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
    const dayOccurrences: ScheduleOccurrence[] = getOccurrencesStartingOnDate(
      draftedSeries,
      date,
      overrideIndex,
      true,
    )
    for (const occurrence of dayOccurrences) {
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
