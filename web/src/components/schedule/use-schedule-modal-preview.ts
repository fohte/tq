import type { ScheduleEditFormState } from '#components/schedule/schedule-edit-dialog-form-state'
import { buildScheduleEditPreviewRequest } from '#components/schedule/schedule-edit-dialog-preview-request'
import {
  currentScheduleEditAction,
  scheduleEditStartDate,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  buildAllScheduleInput,
  buildFollowingScheduleInput,
  endSeriesRemovesSchedule,
  previousScheduleDate,
} from '#components/schedule/schedule-edit-dialog-update-input'
import { describeSchedulePreview } from '#components/schedule/schedule-preview-description'
import { useDebounce } from '#hooks/use-debounce'
import {
  type Schedule,
  type ScheduleDetails,
  type UpdateScheduleInput,
  useScheduleChangePreview,
} from '#hooks/use-schedules'

export function useScheduleModalPreview({
  schedule,
  editState,
  details,
  open,
}: {
  schedule: Schedule | undefined
  editState: ScheduleEditFormState
  details: ScheduleDetails | undefined
  open: boolean
}) {
  const { rangeDraft } = editState
  const scope = rangeDraft.scope
  const activeRecurrence =
    scope === 'all' ? editState.allRecurrence : editState.followingRecurrence
  const recurrence: UpdateScheduleInput['recurrence'] = activeRecurrence.type
    ? {
        type: activeRecurrence.type,
        interval: activeRecurrence.interval,
        ...(activeRecurrence.type === 'weekly' &&
        activeRecurrence.daysOfWeek.length > 0
          ? { daysOfWeek: activeRecurrence.daysOfWeek }
          : {}),
        ...(activeRecurrence.type === 'monthly' && activeRecurrence.dayOfMonth
          ? { dayOfMonth: Number.parseInt(activeRecurrence.dayOfMonth, 10) }
          : {}),
      }
    : null
  const followingInput = buildFollowingScheduleInput(
    schedule,
    rangeDraft,
    recurrence,
  )
  const allInput = buildAllScheduleInput({
    schedule,
    draft: rangeDraft,
    recurrence,
    title: editState.title,
    context: editState.context,
    color: editState.color,
    remindBeforeMinutes: editState.remindBeforeMinutes,
    currentReminder: details?.remindBeforeMinutes ?? null,
    currentDetails: details,
  })
  const rangeAction = currentScheduleEditAction(rangeDraft)
  const endSeriesEndDate =
    scope === 'following' &&
    rangeAction === 'endSeries' &&
    endSeriesRemovesSchedule(schedule, rangeDraft)
      ? previousScheduleDate(rangeDraft.following.fromDate)
      : undefined
  const previewRequest = buildScheduleEditPreviewRequest(
    schedule,
    rangeDraft,
    rangeAction,
    followingInput,
    allInput,
  )
  const previewRequestKey =
    previewRequest == null ? '' : JSON.stringify(previewRequest)
  const debouncedPreviewRequestKey = useDebounce(previewRequestKey, 300)
  const isPreviewRequestDebouncing =
    previewRequest != null && previewRequestKey !== debouncedPreviewRequestKey
  const activePreviewRequest = isPreviewRequestDebouncing
    ? null
    : previewRequest
  const previewQuery = useScheduleChangePreview(
    schedule?.scheduleId,
    activePreviewRequest,
    open && schedule != null,
  )
  const previewText =
    previewRequest == null
      ? endSeriesEndDate !== undefined
        ? 'Ending the series before its first occurrence removes the schedule.'
        : null
      : isPreviewRequestDebouncing || previewQuery.data == null
        ? null
        : describeSchedulePreview(
            previewQuery.data,
            scope,
            rangeAction,
            scope === 'this'
              ? rangeDraft.thisEvent.date
              : scope === 'following'
                ? rangeDraft.following.fromDate
                : scheduleEditStartDate(rangeDraft),
          )

  return {
    allInput,
    followingInput,
    recurrence,
    rangeAction,
    endSeriesEndDate,
    previewRequest,
    previewQuery,
    isPreviewRequestDebouncing,
    activePreviewRequest,
    previewText,
    isPreviewLoading:
      previewRequest != null &&
      (isPreviewRequestDebouncing || previewQuery.isFetching),
    previewError:
      activePreviewRequest != null &&
      (previewQuery.isError ||
        (previewQuery.isSuccess && previewQuery.data == null)),
  }
}
