import {
  expandScheduleWithDraft,
  formatDateStr,
  type ScheduleDraft,
  type ScheduleDraftOccurrence,
  scheduleOccursOnDateWithDraft,
  type ScheduleOverrideTimes,
  type ScheduleSeries,
} from '#routes/schedule-expansion'
import { MAX_SCHEDULE_DATE_RANGE_DAYS } from '#schemas/schedule'

export type SchedulePreviewRange = {
  startDate: string
  endDate: string
}

export type SchedulePreviewOverride = {
  scheduleId: string
  occurrenceDate: string
  startTime: string | null
  endTime: string | null
  movedToDate: string | null
  skipped: boolean
}

export type ScheduleChangePreview = {
  range: SchedulePreviewRange
  changes: Array<{
    before: ScheduleDraftOccurrence | null
    after: ScheduleDraftOccurrence | null
  }>
  deletedOverrides: SchedulePreviewOverride[]
}

export function buildSchedulePreviewRange(
  series: ScheduleSeries,
  startDate?: string,
): SchedulePreviewRange {
  const firstDate = series.revisions[0]?.revision.effectiveFrom
  const requestedStart = startDate ?? formatDateStr(new Date())
  const resolvedStart =
    startDate !== undefined
      ? requestedStart
      : firstDate != null && requestedStart < firstDate
        ? firstDate
        : requestedStart
  const end = new Date(`${resolvedStart}T00:00:00`)
  end.setDate(end.getDate() + MAX_SCHEDULE_DATE_RANGE_DAYS - 1)

  return { startDate: resolvedStart, endDate: formatDateStr(end) }
}

export function buildScheduleOverridePreview(
  series: ScheduleSeries,
  overrides: SchedulePreviewOverride[],
  occurrenceDate: string,
  values: ScheduleOverrideTimes,
): ScheduleChangePreview {
  const existingOverride = overrides.find(
    (override) => override.occurrenceDate === occurrenceDate,
  )
  const beforeDate = existingOverride?.movedToDate ?? occurrenceDate
  const afterDate = values.movedToDate ?? occurrenceDate
  const afterOverrides = [
    ...overrides.filter(
      (override) => override.occurrenceDate !== occurrenceDate,
    ),
    {
      scheduleId: series.schedule.id,
      occurrenceDate,
      ...values,
    },
  ]
  const before = expandScheduleWithDraft({
    series,
    overrides,
    startDate: beforeDate,
    endDate: beforeDate,
    draft: {},
  }).filter((occurrence) => occurrence.originalDate === occurrenceDate)
  const after = expandScheduleWithDraft({
    series,
    overrides: afterOverrides,
    startDate: afterDate,
    endDate: afterDate,
    draft: {},
  }).filter((occurrence) => occurrence.originalDate === occurrenceDate)
  const range = {
    startDate: beforeDate < afterDate ? beforeDate : afterDate,
    endDate: beforeDate > afterDate ? beforeDate : afterDate,
  }

  return buildScheduleChangePreviewFromOccurrences(range, before, after, [])
}

export function getDeletedScheduleOverrides(
  series: ScheduleSeries,
  overrides: readonly SchedulePreviewOverride[],
  draft: ScheduleDraft,
): SchedulePreviewOverride[] {
  const revisionChange = draft.revisionChange
  const shouldPruneObsoleteOccurrences =
    revisionChange != null &&
    revisionChange.mode !== 'all' &&
    revisionChange.mode !== 'replace' &&
    (revisionChange.startTime !== undefined ||
      revisionChange.endTime !== undefined ||
      revisionChange.recurrence !== undefined)

  return overrides
    .filter((override) => {
      if (draft.endDate != null && override.occurrenceDate > draft.endDate) {
        return true
      }

      return (
        shouldPruneObsoleteOccurrences &&
        override.occurrenceDate >= revisionChange.effectiveFrom &&
        !scheduleOccursOnDateWithDraft(
          series,
          new Date(`${override.occurrenceDate}T00:00:00`),
          draft,
        )
      )
    })
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate))
}

export function buildScheduleChangePreview(
  series: ScheduleSeries,
  overrides: SchedulePreviewOverride[],
  range: SchedulePreviewRange,
  draft: ScheduleDraft,
  deletedOverrides: SchedulePreviewOverride[],
): ScheduleChangePreview {
  const before = expandScheduleWithDraft({
    series,
    overrides,
    ...range,
    draft: {},
  })
  const after = expandScheduleWithDraft({
    series,
    overrides,
    ...range,
    draft,
  })
  return buildScheduleChangePreviewFromOccurrences(
    range,
    before,
    after,
    deletedOverrides,
  )
}

export function buildScheduleChangePreviewFromOccurrences(
  range: SchedulePreviewRange,
  before: ScheduleDraftOccurrence[],
  after: ScheduleDraftOccurrence[],
  deletedOverrides: SchedulePreviewOverride[],
): ScheduleChangePreview {
  const beforeByDate = new Map(
    before.map((occurrence) => [occurrence.originalDate, occurrence]),
  )
  const afterByDate = new Map(
    after.map((occurrence) => [occurrence.originalDate, occurrence]),
  )
  const originalDates = [
    ...new Set([...beforeByDate.keys(), ...afterByDate.keys()]),
  ].sort((a, b) => a.localeCompare(b))

  return {
    range,
    changes: originalDates.flatMap((originalDate) => {
      const beforeOccurrence = beforeByDate.get(originalDate) ?? null
      const afterOccurrence = afterByDate.get(originalDate) ?? null
      if (
        beforeOccurrence != null &&
        afterOccurrence != null &&
        beforeOccurrence.date === afterOccurrence.date &&
        beforeOccurrence.startTime === afterOccurrence.startTime &&
        beforeOccurrence.endTime === afterOccurrence.endTime &&
        beforeOccurrence.skipped === afterOccurrence.skipped
      ) {
        return []
      }

      return [{ before: beforeOccurrence, after: afterOccurrence }]
    }),
    deletedOverrides,
  }
}
