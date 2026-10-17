import { useCallback } from 'react'

import type { ScheduleConstraintFormState } from '#components/schedule/schedule-constraints-form-state'
import {
  scheduleConstraintFormStateError,
  scheduleConstraintInputFromFormState,
  scheduleConstraintsMatchSaved,
} from '#components/schedule/schedule-constraints-form-state'
import type { ScheduleEditFormState } from '#components/schedule/schedule-edit-dialog-form-state'
import type {
  ScheduleEditAction,
  ScheduleEditScope,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  scheduleEditEndTime,
  scheduleEditStartDate,
  scheduleEditStartTime,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  endSeriesRemovesSchedule,
  previousScheduleDate,
} from '#components/schedule/schedule-edit-dialog-update-input'
import {
  type CreateScheduleInput,
  type Schedule,
  type ScheduleConstraint,
  type ScheduleDetails,
  type SchedulePreviewRequest,
  type UpdateScheduleInput,
  useClearScheduleOverride,
  useCreateSchedule,
  useDeleteSchedule,
  useDeleteScheduleConstraints,
  useSetScheduleConstraints,
  useSetScheduleOverride,
  useUpdateSchedule,
} from '#hooks/use-schedules'

export function useScheduleModalSave({
  schedule,
  editState,
  details,
  constraintDraft,
  savedConstraint,
  isDetailsFetching,
  rangeAction,
  previewRequest,
  previewReady,
  isPreviewRequestDebouncing,
  followingInput,
  allInput,
  recurrence,
  handleOpenChange,
}: {
  schedule: Schedule | undefined
  editState: ScheduleEditFormState
  details: ScheduleDetails | undefined
  constraintDraft: ScheduleConstraintFormState | null
  savedConstraint: ScheduleConstraint | null
  isDetailsFetching: boolean
  rangeAction: ScheduleEditAction
  previewRequest: SchedulePreviewRequest | null
  previewReady: boolean
  isPreviewRequestDebouncing: boolean
  followingInput: UpdateScheduleInput
  allInput: UpdateScheduleInput
  recurrence: UpdateScheduleInput['recurrence']
  handleOpenChange: (open: boolean) => void
}) {
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const setScheduleConstraints = useSetScheduleConstraints()
  const deleteScheduleConstraints = useDeleteScheduleConstraints()
  const setScheduleOverride = useSetScheduleOverride()
  const clearScheduleOverride = useClearScheduleOverride()
  const isPending =
    createSchedule.isPending ||
    updateSchedule.isPending ||
    deleteSchedule.isPending ||
    setScheduleConstraints.isPending ||
    deleteScheduleConstraints.isPending ||
    setScheduleOverride.isPending ||
    clearScheduleOverride.isPending
  const reminderReady = !schedule || (details != null && !isDetailsFetching)
  const { rangeDraft } = editState
  const scope: ScheduleEditScope = rangeDraft.scope
  const occurrenceDate = rangeDraft.occurrenceDate
  const startDate = scheduleEditStartDate(rangeDraft)
  const startTime = scheduleEditStartTime(rangeDraft)
  const endTime = scheduleEditEndTime(rangeDraft)
  const constraintInput = scheduleConstraintInputFromFormState(constraintDraft)
  const constraintsChanged = !scheduleConstraintsMatchSaved(
    constraintDraft,
    savedConstraint,
  )
  const canSubmit = Boolean(
    ((schedule && scope !== 'all') || editState.title.trim()) &&
    startDate &&
    startTime &&
    endTime &&
    (constraintDraft === null ||
      scheduleConstraintFormStateError(constraintDraft) === null) &&
    (scope !== 'all' || !schedule || reminderReady) &&
    (previewRequest == null || (!isPreviewRequestDebouncing && previewReady)),
  )

  const handleSubmit = () => {
    if (!canSubmit || isPending) return

    const closeOnSuccess = () => {
      handleOpenChange(false)
    }

    const saveSchedule = () => {
      if (schedule) {
        if (scope === 'this') {
          if (rangeAction == null && previewRequest == null) {
            closeOnSuccess()
            return
          }
          if (rangeAction === 'skip') {
            setScheduleOverride.mutate(
              {
                scheduleId: schedule.scheduleId,
                occurrenceDate,
                input: { skipped: true },
              },
              { onSuccess: closeOnSuccess },
            )
          } else if (rangeAction === 'restore') {
            clearScheduleOverride.mutate(
              { scheduleId: schedule.scheduleId, occurrenceDate },
              { onSuccess: closeOnSuccess },
            )
          } else {
            setScheduleOverride.mutate(
              {
                scheduleId: schedule.scheduleId,
                occurrenceDate,
                input: {
                  date: rangeDraft.thisEvent.date,
                  startTime: rangeDraft.thisEvent.startTime,
                  endTime: rangeDraft.thisEvent.endTime,
                },
              },
              { onSuccess: closeOnSuccess },
            )
          }
        } else if (scope === 'following') {
          if (rangeAction === 'endSeries') {
            const endDate = previousScheduleDate(rangeDraft.following.fromDate)
            if (endSeriesRemovesSchedule(schedule, rangeDraft)) {
              deleteSchedule.mutate(schedule.scheduleId, {
                onSuccess: closeOnSuccess,
              })
            } else {
              updateSchedule.mutate(
                { id: schedule.scheduleId, input: { endDate } },
                { onSuccess: closeOnSuccess },
              )
            }
          } else {
            updateSchedule.mutate(
              { id: schedule.scheduleId, input: followingInput },
              { onSuccess: closeOnSuccess },
            )
          }
        } else {
          updateSchedule.mutate(
            { id: schedule.scheduleId, input: allInput },
            { onSuccess: closeOnSuccess },
          )
        }
        return
      }

      const input: CreateScheduleInput = {
        title: editState.title.trim(),
        startDate,
        startTime,
        endTime,
        ...(recurrence ? { recurrence } : {}),
        ...(editState.remindBeforeMinutes === ''
          ? {}
          : { remindBeforeMinutes: editState.remindBeforeMinutes }),
        ...(editState.context ? { context: editState.context } : {}),
        ...(editState.color ? { color: editState.color } : {}),
      }

      createSchedule.mutate(input, { onSuccess: closeOnSuccess })
    }

    if (schedule && constraintsChanged) {
      const saveScheduleAfterConstraints = () => {
        saveSchedule()
      }
      if (constraintInput === null) {
        deleteScheduleConstraints.mutate(schedule.scheduleId, {
          onSuccess: saveScheduleAfterConstraints,
        })
      } else {
        setScheduleConstraints.mutate(
          { id: schedule.scheduleId, input: constraintInput },
          { onSuccess: saveScheduleAfterConstraints },
        )
      }
      return
    }

    saveSchedule()
  }

  const handleDelete = useCallback(() => {
    if (!schedule) return
    deleteSchedule.mutate(schedule.scheduleId, {
      onSuccess: () => {
        handleOpenChange(false)
      },
    })
  }, [schedule, deleteSchedule, handleOpenChange])

  return {
    canSubmit,
    handleDelete,
    handleSubmit,
    isPending,
    isRestorePending: clearScheduleOverride.isPending,
    reminderReady,
  }
}
