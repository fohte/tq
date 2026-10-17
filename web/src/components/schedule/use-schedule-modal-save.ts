import type { Dispatch, SetStateAction } from 'react'
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
  saveState,
  setSaveState,
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
  saveState: ScheduleModalSaveState
  setSaveState: Dispatch<SetStateAction<ScheduleModalSaveState>>
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
  const { createdScheduleId, createdScheduleConstraintsSaved } = saveState
  const updateSaveState = (updates: Partial<ScheduleModalSaveState>) => {
    setSaveState((prev) => ({ ...prev, ...updates }))
  }
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

  const persistConstraints = (id: string, onSuccess: () => void) => {
    const onError = () => {
      updateSaveState({ constraintsSaveError: true })
    }
    if (constraintDraft === null) {
      deleteScheduleConstraints.mutate(id, { onSuccess, onError })
    } else if (constraintInput !== null) {
      setScheduleConstraints.mutate(
        { id, input: constraintInput },
        { onSuccess, onError },
      )
    }
  }

  const handleSubmit = () => {
    if (!canSubmit || isPending) return

    updateSaveState({
      constraintsSaveError: false,
      scheduleAfterConstraintsSaveError: false,
    })

    const closeOnSuccess = () => {
      handleOpenChange(false)
    }

    const scheduleSaveOptions = (constraintsWereSaved: boolean) => ({
      onSuccess: closeOnSuccess,
      ...(constraintsWereSaved
        ? {
            onError: () => {
              updateSaveState({ scheduleAfterConstraintsSaveError: true })
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
              updateSaveState({ constraintsSaveError: true })
              return
            }

            updateSaveState({ createdScheduleId: createdSchedule.id })
            persistConstraints(createdSchedule.id, () => {
              updateSaveState({ createdScheduleConstraintsSaved: true })
              closeOnSuccess()
            })
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
            persistConstraints(createdScheduleId, () => {
              updateSaveState({ createdScheduleConstraintsSaved: false })
              updateCreatedSchedule(true)
            })
          } else {
            updateCreatedSchedule(false)
          }
          return
        }

        if (constraintInput === null) return
        persistConstraints(createdScheduleId, () => {
          updateSaveState({ createdScheduleConstraintsSaved: true })
          updateCreatedSchedule(true)
        })
      }
      saveConstraints()
    }

    if (schedule && scope === 'all' && constraintsChanged) {
      const saveScheduleAfterConstraints = () => {
        updateSaveState({ constraintsSaveError: false })
        saveSchedule(true)
      }
      persistConstraints(schedule.scheduleId, saveScheduleAfterConstraints)
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
    reminderReady,
  }
}

export interface ScheduleModalSaveState {
  constraintsSaveError: boolean
  scheduleAfterConstraintsSaveError: boolean
  createdScheduleId: string | null
  createdScheduleConstraintsSaved: boolean
}
