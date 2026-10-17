import { useCallback, useEffect, useRef, useState } from 'react'

import type { ScheduleConstraintFormState } from '#components/schedule/schedule-constraints-form-state'
import {
  emptyScheduleConstraintFormState,
  scheduleConstraintFormStateFromSaved,
} from '#components/schedule/schedule-constraints-form-state'
import {
  type RecurrenceFormDraft,
  scheduleEditDialogFormState,
} from '#components/schedule/schedule-edit-dialog-form-state'
import type {
  ScheduleEditAction,
  ScheduleEditScope,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  createScheduleEditDraft,
  scheduleEditEndTime,
  scheduleEditStartDate,
  scheduleEditStartTime,
  setScheduleEditEndTime,
  setScheduleEditStartDate,
  setScheduleEditStartTime,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  type RecurrenceType,
  toggleWeekday,
} from '#components/schedule/schedule-modal-form-options'
import type { SchedulePanelProps } from '#components/schedule/schedule-modal-panel-props'
import { useScheduleModalPreview } from '#components/schedule/use-schedule-modal-preview'
import { useScheduleModalSave } from '#components/schedule/use-schedule-modal-save'
import type { Schedule } from '#hooks/use-schedules'
import {
  useScheduleConstraints,
  useScheduleDetails,
  useScheduleOverrides,
} from '#hooks/use-schedules'
import { formatLocalDate } from '#lib/date-range'

interface CreateScheduleModalStateOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: Schedule | undefined
  defaultStartDate: string
}

export function useCreateScheduleModalState({
  open,
  onOpenChange,
  schedule,
  defaultStartDate,
}: CreateScheduleModalStateOptions) {
  const [editState, setEditState] = useState(() =>
    scheduleEditDialogFormState(schedule, defaultStartDate, undefined),
  )
  const reminderTouchedRef = useRef(false)
  const wasOpenRef = useRef(open)
  const detailsHydratedForRef = useRef<string | null>(null)

  const scheduleDetails = useScheduleDetails(
    schedule?.scheduleId,
    open && schedule != null,
  )
  const scheduleConstraints = useScheduleConstraints(
    schedule?.scheduleId,
    open && schedule != null,
  )
  const [constraintDraft, setConstraintDraft] =
    useState<ScheduleConstraintFormState | null>(null)
  const constraintTouchedRef = useRef(false)
  const today = formatLocalDate(new Date())
  const exceptionQuery = useScheduleOverrides(
    schedule?.scheduleId,
    open && schedule != null,
    today,
  )

  useEffect(() => {
    const didOpen = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (didOpen && !schedule) {
      setEditState((prev) => ({
        ...prev,
        rangeDraft: createScheduleEditDraft(undefined, defaultStartDate),
      }))
    }
  }, [defaultStartDate, open, schedule])

  useEffect(() => {
    const details = scheduleDetails.data
    if (!open || !schedule || !details || scheduleDetails.isFetching) {
      return
    }
    const hydrationKey = `${schedule.scheduleId}:${details.updatedAt}`
    if (detailsHydratedForRef.current === hydrationKey) return
    detailsHydratedForRef.current = hydrationKey
    const nextFormState = scheduleEditDialogFormState(
      schedule,
      defaultStartDate,
      details,
    )
    setEditState((prev) => ({
      ...nextFormState,
      remindBeforeMinutes: reminderTouchedRef.current
        ? prev.remindBeforeMinutes
        : nextFormState.remindBeforeMinutes,
    }))
  }, [
    defaultStartDate,
    open,
    schedule,
    scheduleDetails.data,
    scheduleDetails.isFetching,
  ])

  useEffect(() => {
    if (
      !open ||
      !schedule ||
      scheduleConstraints.isFetching ||
      scheduleConstraints.data === undefined ||
      constraintTouchedRef.current
    ) {
      return
    }
    setConstraintDraft(
      scheduleConstraintFormStateFromSaved(scheduleConstraints.data.constraint),
    )
  }, [open, schedule, scheduleConstraints.data, scheduleConstraints.isFetching])

  const resetForm = useCallback(() => {
    setEditState(
      scheduleEditDialogFormState(
        schedule,
        defaultStartDate,
        scheduleDetails.data,
      ),
    )
    reminderTouchedRef.current = false
    constraintTouchedRef.current = false
    setConstraintDraft(
      schedule
        ? scheduleConstraintFormStateFromSaved(
            scheduleConstraints.data?.constraint ?? null,
          )
        : null,
    )
  }, [
    defaultStartDate,
    schedule,
    scheduleConstraints.data,
    scheduleDetails.data,
  ])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetForm()
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetForm],
  )

  const { rangeDraft } = editState
  const scope = rangeDraft.scope
  const activeRecurrence =
    scope === 'all' ? editState.allRecurrence : editState.followingRecurrence
  const recurrenceType = activeRecurrence.type
  const daysOfWeek = activeRecurrence.daysOfWeek
  const dayOfMonth = activeRecurrence.dayOfMonth
  const occurrenceDate = rangeDraft.occurrenceDate
  const startDate = scheduleEditStartDate(rangeDraft)
  const startTime = scheduleEditStartTime(rangeDraft)
  const endTime = scheduleEditEndTime(rangeDraft)
  const preview = useScheduleModalPreview({
    schedule,
    editState,
    details: scheduleDetails.data,
    open,
  })
  const save = useScheduleModalSave({
    schedule,
    editState,
    details: scheduleDetails.data,
    constraintDraft,
    savedConstraint: scheduleConstraints.data?.constraint ?? null,
    isDetailsFetching: scheduleDetails.isFetching,
    rangeAction: preview.rangeAction,
    previewRequest: preview.previewRequest,
    previewReady:
      preview.previewQuery.isSuccess && preview.previewQuery.data != null,
    isPreviewRequestDebouncing: preview.isPreviewRequestDebouncing,
    followingInput: preview.followingInput,
    allInput: preview.allInput,
    recurrence: preview.recurrence,
    handleOpenChange,
  })
  const canRestoreThisEvent = Boolean(
    schedule?.overridden != null ||
    exceptionQuery.data?.some(
      (exception) => exception.occurrenceDate === occurrenceDate,
    ),
  )

  const handleRestoreException = useCallback(
    (exceptionOccurrenceDate: string) => {
      setEditState((prev) => ({
        ...prev,
        rangeDraft: {
          ...prev.rangeDraft,
          scope: 'this',
          occurrenceDate: exceptionOccurrenceDate,
          thisEvent: {
            ...prev.rangeDraft.thisEvent,
            date: exceptionOccurrenceDate,
            action: 'restore',
          },
        },
      }))
    },
    [],
  )

  const updateActiveRecurrence = (
    updater: (prev: RecurrenceFormDraft) => RecurrenceFormDraft,
  ) => {
    setEditState((prev) =>
      prev.rangeDraft.scope === 'all'
        ? { ...prev, allRecurrence: updater(prev.allRecurrence) }
        : { ...prev, followingRecurrence: updater(prev.followingRecurrence) },
    )
  }
  const setRecurrenceType = (value: RecurrenceType | '') => {
    updateActiveRecurrence((prev) => ({ ...prev, type: value }))
  }
  const toggleDay = (day: number) => {
    updateActiveRecurrence((prev) => ({
      ...prev,
      daysOfWeek: toggleWeekday(prev.daysOfWeek, day),
    }))
  }
  const setDayOfMonth = (value: string) => {
    updateActiveRecurrence((prev) => ({ ...prev, dayOfMonth: value }))
  }

  const setScope = (nextScope: ScheduleEditScope) => {
    setEditState((prev) => ({
      ...prev,
      rangeDraft: { ...prev.rangeDraft, scope: nextScope },
    }))
  }
  const setRangeAction = (action: ScheduleEditAction) => {
    setEditState((prev) => {
      if (prev.rangeDraft.scope === 'this') {
        if (action === 'endSeries') return prev
        return {
          ...prev,
          rangeDraft: {
            ...prev.rangeDraft,
            thisEvent: {
              ...prev.rangeDraft.thisEvent,
              action:
                prev.rangeDraft.thisEvent.action === action ? null : action,
            },
          },
        }
      }
      if (prev.rangeDraft.scope === 'following') {
        return {
          ...prev,
          rangeDraft: {
            ...prev.rangeDraft,
            following: {
              ...prev.rangeDraft.following,
              endSeries:
                action === 'endSeries' && !prev.rangeDraft.following.endSeries,
            },
          },
        }
      }
      return prev
    })
  }
  const setStartDate = (value: string) => {
    setEditState((prev) => ({
      ...prev,
      rangeDraft: setScheduleEditStartDate(prev.rangeDraft, value),
    }))
  }
  const setStartTime = (value: string) => {
    setEditState((prev) => ({
      ...prev,
      rangeDraft: setScheduleEditStartTime(prev.rangeDraft, value),
    }))
  }
  const setEndTime = (value: string) => {
    setEditState((prev) => ({
      ...prev,
      rangeDraft: setScheduleEditEndTime(prev.rangeDraft, value),
    }))
  }
  const setTitle = (value: string) => {
    setEditState((prev) => ({ ...prev, title: value }))
  }
  const setContext = (value: typeof editState.context) => {
    setEditState((prev) => ({ ...prev, context: value }))
  }
  const setColor = (value: string) => {
    setEditState((prev) => ({ ...prev, color: value }))
  }
  const setRemindBeforeMinutes = (value: number | '') => {
    reminderTouchedRef.current = true
    setEditState((prev) => ({ ...prev, remindBeforeMinutes: value }))
  }
  const addConstraints = () => {
    constraintTouchedRef.current = true
    setConstraintDraft(emptyScheduleConstraintFormState())
  }
  const updateConstraints = (value: ScheduleConstraintFormState) => {
    constraintTouchedRef.current = true
    setConstraintDraft(value)
  }
  const removeConstraints = () => {
    constraintTouchedRef.current = true
    setConstraintDraft(null)
  }

  const panelProps: SchedulePanelProps = {
    schedule,
    handleOpenChange,
    scope,
    setScope,
    occurrenceDate,
    rangeAction: preview.rangeAction,
    setRangeAction,
    canRestoreThisEvent,
    canEditTitle: !schedule || scope === 'all',
    canEditSeriesDetails: scope !== 'this',
    title: editState.title,
    setTitle,
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    recurrenceType,
    setRecurrenceType,
    daysOfWeek,
    toggleDay,
    dayOfMonth,
    setDayOfMonth,
    context: editState.context,
    setContext,
    color: editState.color,
    setColor,
    exceptions: exceptionQuery.data ?? [],
    isExceptionsLoading: exceptionQuery.isLoading,
    isExceptionsError: exceptionQuery.isError,
    onRestoreException: handleRestoreException,
    isRestorePending: save.isRestorePending,
    remindBeforeMinutes: editState.remindBeforeMinutes,
    setRemindBeforeMinutes,
    reminderReady: save.reminderReady,
    constraints: constraintDraft,
    constraintsLoading: Boolean(
      schedule &&
      (scheduleConstraints.isPending || scheduleConstraints.isFetching),
    ),
    constraintsError: Boolean(schedule && scheduleConstraints.isError),
    constraintsDefaultOpen:
      constraintDraft !== null && scheduleConstraints.data?.constraint == null,
    onAddConstraints: addConstraints,
    onChangeConstraints: updateConstraints,
    onRemoveConstraints: removeConstraints,
    previewText: preview.previewText,
    isPreviewLoading: preview.isPreviewLoading,
    previewError: preview.previewError,
    onDelete: save.handleDelete,
    isPending: save.isPending,
    canSubmit: save.canSubmit,
    handleSubmit: save.handleSubmit,
  }

  return { panelProps }
}
