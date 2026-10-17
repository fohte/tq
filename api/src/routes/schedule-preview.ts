import { z } from 'zod'

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

const scheduleDraftOccurrenceSchema = z.object({
  date: z.iso.date(),
  originalDate: z.iso.date(),
  startTime: z.string(),
  endTime: z.string(),
  skipped: z.boolean(),
})

const schedulePreviewRangeSchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .describe(
    'The inclusive date range covered by changes. deletedOverrides may include occurrences outside this range.',
  )

const schedulePreviewOverrideSchema = z.object({
  scheduleId: z.uuid(),
  occurrenceDate: z.iso.date(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  movedToDate: z.iso.date().nullable(),
  skipped: z.boolean(),
})

const scheduleChangePreviewSchema = z.object({
  range: schedulePreviewRangeSchema,
  changes: z.array(
    z.object({
      before: scheduleDraftOccurrenceSchema.nullable(),
      after: scheduleDraftOccurrenceSchema.nullable(),
    }),
  ),
  deletedOverrides: z.array(schedulePreviewOverrideSchema),
})

export type SchedulePreviewRange = z.infer<typeof schedulePreviewRangeSchema>
export type SchedulePreviewOverride = z.infer<
  typeof schedulePreviewOverrideSchema
>
export type ScheduleChangePreview = z.infer<typeof scheduleChangePreviewSchema>

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

export function buildScheduleOverrideClearPreview(
  series: ScheduleSeries,
  overrides: SchedulePreviewOverride[],
  occurrenceDate: string,
): ScheduleChangePreview {
  const existingOverride = overrides.find(
    (override) => override.occurrenceDate === occurrenceDate,
  )
  const movedToDate = existingOverride?.movedToDate ?? occurrenceDate
  const range = {
    startDate: occurrenceDate < movedToDate ? occurrenceDate : movedToDate,
    endDate: occurrenceDate > movedToDate ? occurrenceDate : movedToDate,
  }
  const restoredOverrides = overrides.filter(
    (override) => override.occurrenceDate !== occurrenceDate,
  )
  const before = expandScheduleWithDraft({
    series,
    overrides,
    ...range,
    draft: {},
  }).filter((occurrence) => occurrence.originalDate === occurrenceDate)
  const after = expandScheduleWithDraft({
    series,
    overrides: restoredOverrides,
    ...range,
    draft: {},
  }).filter((occurrence) => occurrence.originalDate === occurrenceDate)

  return buildScheduleChangePreviewFromOccurrences(range, before, after, [])
}

export function getDeletedScheduleOverrides(
  series: ScheduleSeries,
  overrides: readonly SchedulePreviewOverride[],
  draft: ScheduleDraft,
  revisionMode: 'from' | 'all' | 'replace' = 'from',
): SchedulePreviewOverride[] {
  const revisionChange = draft.revisionChange
  const shouldPruneObsoleteOccurrences =
    revisionChange != null &&
    revisionMode === 'from' &&
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
  revisionMode: 'from' | 'all' | 'replace' = 'from',
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
    revisionMode,
  })
  return buildScheduleChangePreviewFromOccurrences(
    range,
    before,
    after,
    deletedOverrides,
  )
}

function buildScheduleChangePreviewFromOccurrences(
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

  return scheduleChangePreviewSchema.parse({
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
  })
}
