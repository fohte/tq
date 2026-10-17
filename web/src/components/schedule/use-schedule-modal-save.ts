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
  constraintsSaveError,
  setConstraintsSaveError,
  setScheduleAfterConstraintsSaveError,
  createdScheduleId,
  setCreatedScheduleId,
  createdScheduleConstraintsSaved,
  setCreatedScheduleConstraintsSaved,
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
  constraintsSaveError: boolean
  setConstraintsSaveError: (value: boolean) => void
  setScheduleAfterConstraintsSaveError: (value: boolean) => void
  createdScheduleId: string | null
  setCreatedScheduleId: (value: string | null) => void
  createdScheduleConstraintsSaved: boolean
  setCreatedScheduleConstraintsSaved: (value: boolean) => void
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
  const canSaveConstraints = !schedule || scope === 'all'
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
      !canSaveConstraints ||
      scheduleConstraintFormStateError(constraintDraft) === null) &&
    (scope !== 'all' || !schedule || reminderReady) &&
    (previewRequest == null || (!isPreviewRequestDebouncing && previewReady)),
  )

  const handleSubmit = () => {
    if (!canSubmit || isPending) return

    setConstraintsSaveError(false)
    setScheduleAfterConstraintsSaveError(false)

    const closeOnSuccess = () => {
      handleOpenChange(false)
    }

    const scheduleSaveOptions = (constraintsWereSaved: boolean) => ({
      onSuccess: closeOnSuccess,
      ...(constraintsWereSaved
        ? {
            onError: () => {
              setScheduleAfterConstraintsSaveError(true)
            },
          }
        : {}),
    })

    const createInput: CreateScheduleInput = {
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
    const createdScheduleUpdateInput: UpdateScheduleInput = {
      title: createInput.title,
      startDate: createInput.startDate,
      startTime: createInput.startTime,
      endTime: createInput.endTime,
      recurrence: createInput.recurrence ?? null,
      remindBeforeMinutes: createInput.remindBeforeMinutes ?? null,
      context: editState.context || null,
      color: editState.color || null,
    }

    const saveSchedule = (constraintsWereSaved = false) => {
      if (!schedule) return

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
            scheduleSaveOptions(constraintsWereSaved),
          )
        } else if (rangeAction === 'restore') {
          clearScheduleOverride.mutate(
            { scheduleId: schedule.scheduleId, occurrenceDate },
            scheduleSaveOptions(constraintsWereSaved),
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
            scheduleSaveOptions(constraintsWereSaved),
          )
        }
      } else if (scope === 'following') {
        if (rangeAction === 'endSeries') {
          const endDate = previousScheduleDate(rangeDraft.following.fromDate)
          if (endSeriesRemovesSchedule(schedule, rangeDraft)) {
            deleteSchedule.mutate(
              schedule.scheduleId,
              scheduleSaveOptions(constraintsWereSaved),
            )
          } else {
            updateSchedule.mutate(
              { id: schedule.scheduleId, input: { endDate } },
              scheduleSaveOptions(constraintsWereSaved),
            )
          }
        } else {
          updateSchedule.mutate(
            { id: schedule.scheduleId, input: followingInput },
            scheduleSaveOptions(constraintsWereSaved),
          )
        }
      } else {
        updateSchedule.mutate(
          { id: schedule.scheduleId, input: allInput },
          scheduleSaveOptions(constraintsWereSaved),
        )
      }
    }

    const saveCreatedSchedule = () => {
      if (createdScheduleId === null) {
        createSchedule.mutate(createInput, {
          onSuccess: (createdSchedule) => {
            if (constraintDraft === null) {
              closeOnSuccess()
              return
            }

            if (constraintInput === null) {
              setConstraintsSaveError(true)
              return
            }

            setCreatedScheduleId(createdSchedule.id)
            setScheduleConstraints.mutate(
              { id: createdSchedule.id, input: constraintInput },
              {
                onSuccess: () => {
                  setCreatedScheduleConstraintsSaved(true)
                  closeOnSuccess()
                },
                onError: () => {
                  setConstraintsSaveError(true)
                },
              },
            )
          },
        })
        return
      }

      const updateCreatedSchedule = (constraintsWereSaved: boolean) => {
        updateSchedule.mutate(
          { id: createdScheduleId, input: createdScheduleUpdateInput },
          scheduleSaveOptions(constraintsWereSaved),
        )
      }
      const saveConstraints = () => {
        if (constraintDraft === null) {
          if (createdScheduleConstraintsSaved) {
            deleteScheduleConstraints.mutate(createdScheduleId, {
              onSuccess: () => {
                setCreatedScheduleConstraintsSaved(false)
                updateCreatedSchedule(true)
              },
              onError: () => {
                setConstraintsSaveError(true)
              },
            })
          } else {
            updateCreatedSchedule(false)
          }
          return
        }

        if (constraintInput === null) return
        setScheduleConstraints.mutate(
          { id: createdScheduleId, input: constraintInput },
          {
            onSuccess: () => {
              setCreatedScheduleConstraintsSaved(true)
              updateCreatedSchedule(true)
            },
            onError: () => {
              setConstraintsSaveError(true)
            },
          },
        )
      }
      saveConstraints()
    }

    if (schedule && scope === 'all' && constraintsChanged) {
      const saveScheduleAfterConstraints = () => {
        setConstraintsSaveError(false)
        saveSchedule(true)
      }
      if (constraintDraft === null) {
        deleteScheduleConstraints.mutate(schedule.scheduleId, {
          onSuccess: saveScheduleAfterConstraints,
          onError: () => {
            setConstraintsSaveError(true)
          },
        })
      } else if (constraintInput !== null) {
        setScheduleConstraints.mutate(
          { id: schedule.scheduleId, input: constraintInput },
          {
            onSuccess: saveScheduleAfterConstraints,
            onError: () => {
              setConstraintsSaveError(true)
            },
          },
        )
      }
      return
    }

    if (!schedule) {
      saveCreatedSchedule()
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
    constraintsSaveError,
    reminderReady,
  }
}
