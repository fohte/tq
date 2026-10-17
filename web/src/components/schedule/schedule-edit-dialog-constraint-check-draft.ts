import type {
  ScheduleEditAction,
  ScheduleEditDraft,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  endSeriesRemovesSchedule,
  previousScheduleDate,
} from '#components/schedule/schedule-edit-dialog-update-input'
import type {
  Schedule,
  ScheduleConstraintCheckDraft,
  ScheduleConstraintInput,
  SchedulePreviewRequest,
} from '#hooks/use-schedules'

function scheduleRevisionMode(
  input: Extract<SchedulePreviewRequest, { kind: 'update' }>['input'],
): ScheduleConstraintCheckDraft['revisionMode'] {
  if (input.effectiveFrom !== undefined) return 'from'
  if (input.startDate !== undefined || input.recurrence === null) {
    return 'replace'
  }
  return 'all'
}

export function buildScheduleEditConstraintCheckDraft({
  schedule,
  rangeDraft,
  rangeAction,
  previewRequest,
  constraints,
}: {
  schedule: Schedule | undefined
  rangeDraft: ScheduleEditDraft
  rangeAction: ScheduleEditAction
  previewRequest: SchedulePreviewRequest | null
  constraints?: ScheduleConstraintInput
}): ScheduleConstraintCheckDraft | undefined {
  const draft: ScheduleConstraintCheckDraft = {
    ...(constraints === undefined ? {} : { constraints }),
  }

  if (previewRequest?.kind === 'override') {
    draft.occurrenceChange =
      previewRequest.input.skipped === true
        ? {
            originalDate: previewRequest.occurrenceDate,
            skipped: true,
          }
        : {
            originalDate: previewRequest.occurrenceDate,
            ...(previewRequest.input.date === undefined
              ? {}
              : { date: previewRequest.input.date }),
            startTime: previewRequest.input.startTime,
            endTime: previewRequest.input.endTime,
          }
  } else if (previewRequest?.kind === 'update') {
    const { input } = previewRequest
    if (input.endDate !== undefined) draft.endDate = input.endDate

    const hasRevisionChange =
      input.effectiveFrom !== undefined ||
      input.startDate !== undefined ||
      input.startTime !== undefined ||
      input.endTime !== undefined ||
      input.recurrence !== undefined
    if (hasRevisionChange && schedule) {
      draft.revisionChange = {
        effectiveFrom:
          input.effectiveFrom ?? input.startDate ?? schedule.startDate,
        ...(input.startTime === undefined
          ? {}
          : { startTime: input.startTime }),
        ...(input.endTime === undefined ? {} : { endTime: input.endTime }),
        ...(input.recurrence === undefined
          ? {}
          : { recurrence: input.recurrence }),
      }
      draft.revisionMode = scheduleRevisionMode(input)
    }
  } else if (
    schedule &&
    rangeDraft.scope === 'following' &&
    rangeAction === 'endSeries' &&
    endSeriesRemovesSchedule(schedule, rangeDraft)
  ) {
    draft.endDate = previousScheduleDate(rangeDraft.following.fromDate)
  }

  return Object.keys(draft).length === 0 ? undefined : draft
}
