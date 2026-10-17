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
  SchedulePreviewRequest,
  UpdateScheduleInput,
} from '#hooks/use-schedules'

export function buildScheduleEditPreviewRequest(
  schedule: Schedule | undefined,
  draft: ScheduleEditDraft,
  rangeAction: ScheduleEditAction,
  followingInput: UpdateScheduleInput,
  allInput: UpdateScheduleInput,
): SchedulePreviewRequest | null {
  if (!schedule) return null

  if (draft.scope === 'this') {
    if (rangeAction === 'skip') {
      return {
        kind: 'override',
        occurrenceDate: draft.occurrenceDate,
        input: { skipped: true },
      }
    }
    if (rangeAction === 'restore') {
      return { kind: 'clearOverride', occurrenceDate: draft.occurrenceDate }
    }
    if (
      draft.thisEvent.date === schedule.occurrenceStartDate &&
      draft.thisEvent.startTime === schedule.occurrenceStartTime &&
      draft.thisEvent.endTime === schedule.occurrenceEndTime
    ) {
      return null
    }
    return {
      kind: 'override',
      occurrenceDate: draft.occurrenceDate,
      input: {
        date: draft.thisEvent.date,
        startTime: draft.thisEvent.startTime,
        endTime: draft.thisEvent.endTime,
      },
    }
  }

  if (draft.scope === 'following') {
    if (rangeAction === 'endSeries') {
      const endDate = previousScheduleDate(draft.following.fromDate)
      return endSeriesRemovesSchedule(schedule, draft)
        ? null
        : { kind: 'update', input: { endDate } }
    }
    return Object.keys(followingInput).length > 1
      ? { kind: 'update', input: followingInput }
      : null
  }

  return Object.keys(allInput).length > 0
    ? { kind: 'update', input: allInput }
    : null
}
