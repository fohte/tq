import { useCallback, useEffect, useRef, useState } from 'react'

import {
  draftWithScheduleDetails,
  type RecurrenceFormDraft,
  recurrenceFormFromDetails,
  recurrenceFormFromSchedule,
} from '#components/schedule/schedule-edit-dialog-form-state'
import { buildScheduleEditPreviewRequest } from '#components/schedule/schedule-edit-dialog-preview-request'
import type {
  ScheduleEditAction,
  ScheduleEditScope,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  createScheduleEditDraft,
  currentScheduleEditAction,
  scheduleEditEndTime,
  scheduleEditStartDate,
  scheduleEditStartTime,
  setScheduleEditEndTime,
  setScheduleEditStartDate,
  setScheduleEditStartTime,
} from '#components/schedule/schedule-edit-dialog-state'
import {
  buildAllScheduleInput,
  buildFollowingScheduleInput,
  previousScheduleDate,
} from '#components/schedule/schedule-edit-dialog-update-input'
import {
  type ContextValue,
  type RecurrenceType,
  toggleWeekday,
} from '#components/schedule/schedule-modal-form-options'
import { scheduleContext } from '#components/schedule/schedule-modal-form-utils'
import type { SchedulePanelProps } from '#components/schedule/schedule-modal-panel-props'
import { describeSchedulePreview } from '#components/schedule/schedule-preview-description'
import type { CreateScheduleInput, Schedule } from '#hooks/use-schedules'
import {
  useClearScheduleOverride,
  useCreateSchedule,
  useDeleteSchedule,
  useScheduleChangePreview,
  useScheduleDetails,
  useScheduleOverrides,
  useSetScheduleOverride,
  useUpdateSchedule,
} from '#hooks/use-schedules'

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
  const [rangeDraft, setRangeDraft] = useState(() =>
    createScheduleEditDraft(schedule, defaultStartDate),
  )
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [followingRecurrence, setFollowingRecurrence] = useState(() =>
    recurrenceFormFromSchedule(schedule),
  )
  const [allRecurrence, setAllRecurrence] = useState(() =>
    recurrenceFormFromSchedule(schedule),
  )
  const [context, setContext] = useState<ContextValue | ''>(
    scheduleContext(schedule),
  )
  const [color, setColor] = useState(schedule?.color ?? '')
  const [remindBeforeMinutes, setRemindBeforeMinutesState] = useState<
    number | ''
  >('')
  const reminderTouchedRef = useRef(false)
  const wasOpenRef = useRef(open)
  const detailsHydratedForRef = useRef<string | null>(null)

  const scheduleDetails = useScheduleDetails(
    schedule?.scheduleId,
    open && schedule != null,
  )
  const exceptionQuery = useScheduleOverrides(
    schedule?.scheduleId,
    open && schedule != null,
  )

  useEffect(() => {
    const didOpen = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (didOpen && !schedule) {
      setRangeDraft(createScheduleEditDraft(undefined, defaultStartDate))
    }
  }, [defaultStartDate, open, schedule])

  useEffect(() => {
    const details = scheduleDetails.data
    if (
      !open ||
      !schedule ||
      !details ||
      detailsHydratedForRef.current === schedule.scheduleId
    ) {
      return
    }
    detailsHydratedForRef.current = schedule.scheduleId
    setRangeDraft((prev) => ({
      ...prev,
      all: {
        startDate: details.startDate,
        startTime: details.startTime,
        endTime: details.endTime,
      },
    }))
    setTitle(details.title)
    setAllRecurrence(recurrenceFormFromDetails(details))
    setContext(details.context)
    setColor(details.color ?? '')
    if (!reminderTouchedRef.current) {
      setRemindBeforeMinutesState(details.remindBeforeMinutes ?? '')
    }
  }, [open, schedule, scheduleDetails.data])

  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const setScheduleOverride = useSetScheduleOverride()
  const clearScheduleOverride = useClearScheduleOverride()
  const isPending =
    createSchedule.isPending ||
    updateSchedule.isPending ||
    deleteSchedule.isPending ||
    setScheduleOverride.isPending ||
    clearScheduleOverride.isPending

  const scope = rangeDraft.scope
  const activeRecurrence = scope === 'all' ? allRecurrence : followingRecurrence
  const recurrenceType = activeRecurrence.type
  const daysOfWeek = activeRecurrence.daysOfWeek
  const dayOfMonth = activeRecurrence.dayOfMonth
  const occurrenceDate = rangeDraft.occurrenceDate
  const startDate = scheduleEditStartDate(rangeDraft)
  const startTime = scheduleEditStartTime(rangeDraft)
  const endTime = scheduleEditEndTime(rangeDraft)

  const recurrence = recurrenceType
    ? {
        type: recurrenceType,
        interval: activeRecurrence.interval,
        ...(recurrenceType === 'weekly' && daysOfWeek.length > 0
          ? { daysOfWeek }
          : {}),
        ...(recurrenceType === 'monthly' && dayOfMonth
          ? { dayOfMonth: Number.parseInt(dayOfMonth, 10) }
          : {}),
      }
    : null

  const updateInputForFollowing = () =>
    buildFollowingScheduleInput(schedule, rangeDraft, recurrence)
  const updateInputForAll = () =>
    buildAllScheduleInput({
      schedule,
      draft: rangeDraft,
      recurrence,
      title,
      context,
      color,
      remindBeforeMinutes,
      currentReminder: scheduleDetails.data?.remindBeforeMinutes ?? null,
      currentDetails: scheduleDetails.data,
    })

  const rangeAction = currentScheduleEditAction(rangeDraft)
  const previewRequest = buildScheduleEditPreviewRequest(
    schedule,
    rangeDraft,
    rangeAction,
    updateInputForFollowing(),
    updateInputForAll(),
  )
  const previewQuery = useScheduleChangePreview(
    schedule?.scheduleId,
    previewRequest,
    open && schedule != null,
  )
  const canRestoreThisEvent = Boolean(
    schedule?.overridden != null ||
    exceptionQuery.data?.some(
      (exception) => exception.occurrenceDate === occurrenceDate,
    ),
  )

  const resetForm = useCallback(() => {
    const details = scheduleDetails.data
    setRangeDraft(draftWithScheduleDetails(schedule, defaultStartDate, details))
    setTitle(details?.title ?? schedule?.title ?? '')
    setFollowingRecurrence(recurrenceFormFromSchedule(schedule))
    setAllRecurrence(
      details
        ? recurrenceFormFromDetails(details)
        : recurrenceFormFromSchedule(schedule),
    )
    setContext(details?.context ?? scheduleContext(schedule))
    setColor(details?.color ?? schedule?.color ?? '')
    reminderTouchedRef.current = false
    setRemindBeforeMinutesState(details?.remindBeforeMinutes ?? '')
  }, [defaultStartDate, schedule, scheduleDetails.data])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetForm()
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetForm],
  )

  const handleSubmit = () => {
    if (
      !startDate ||
      !startTime ||
      !endTime ||
      ((!schedule || scope === 'all') && !title.trim()) ||
      (scope === 'all' && schedule && !scheduleDetails.data) ||
      (previewRequest != null &&
        (!previewQuery.isSuccess || previewQuery.data == null)) ||
      isPending
    ) {
      return
    }

    if (schedule) {
      const onSuccess = () => {
        handleOpenChange(false)
      }
      if (scope === 'this') {
        if (rangeAction === 'skip') {
          setScheduleOverride.mutate(
            {
              scheduleId: schedule.scheduleId,
              occurrenceDate,
              input: { skipped: true },
            },
            { onSuccess },
          )
        } else if (rangeAction === 'restore') {
          clearScheduleOverride.mutate(
            { scheduleId: schedule.scheduleId, occurrenceDate },
            { onSuccess },
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
            { onSuccess },
          )
        }
      } else if (scope === 'following') {
        if (rangeAction === 'endSeries') {
          const endDate = previousScheduleDate(rangeDraft.following.fromDate)
          if (endDate < schedule.startDate) {
            deleteSchedule.mutate(schedule.scheduleId, { onSuccess })
          } else {
            updateSchedule.mutate(
              { id: schedule.scheduleId, input: { endDate } },
              { onSuccess },
            )
          }
        } else {
          updateSchedule.mutate(
            { id: schedule.scheduleId, input: updateInputForFollowing() },
            { onSuccess },
          )
        }
      } else {
        updateSchedule.mutate(
          { id: schedule.scheduleId, input: updateInputForAll() },
          { onSuccess },
        )
      }
      return
    }

    const input: CreateScheduleInput = {
      title: title.trim(),
      startDate,
      startTime,
      endTime,
      ...(recurrence ? { recurrence } : {}),
      ...(remindBeforeMinutes === '' ? {} : { remindBeforeMinutes }),
      ...(context ? { context } : {}),
      ...(color ? { color } : {}),
    }

    createSchedule.mutate(input, {
      onSuccess: () => {
        handleOpenChange(false)
      },
    })
  }

  const handleDelete = useCallback(() => {
    if (!schedule) return
    deleteSchedule.mutate(schedule.scheduleId, {
      onSuccess: () => {
        handleOpenChange(false)
      },
    })
  }, [schedule, deleteSchedule, handleOpenChange])

  const handleRestoreException = useCallback(
    (exceptionOccurrenceDate: string) => {
      setRangeDraft((prev) => ({
        ...prev,
        scope: 'this',
        occurrenceDate: exceptionOccurrenceDate,
        thisEvent: {
          ...prev.thisEvent,
          date: exceptionOccurrenceDate,
          action: 'restore',
        },
      }))
    },
    [],
  )

  const updateActiveRecurrence = (
    updater: (prev: RecurrenceFormDraft) => RecurrenceFormDraft,
  ) => {
    const setRecurrence =
      scope === 'all' ? setAllRecurrence : setFollowingRecurrence
    setRecurrence(updater)
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
    setRangeDraft((prev) => ({ ...prev, scope: nextScope }))
  }
  const setRangeAction = (action: ScheduleEditAction) => {
    setRangeDraft((prev) => {
      if (prev.scope === 'this') {
        if (action === 'endSeries') return prev
        return {
          ...prev,
          thisEvent: {
            ...prev.thisEvent,
            action: prev.thisEvent.action === action ? null : action,
          },
        }
      }
      if (prev.scope === 'following') {
        return {
          ...prev,
          following: {
            ...prev.following,
            endSeries: action === 'endSeries' && !prev.following.endSeries,
          },
        }
      }
      return prev
    })
  }
  const setStartDate = (value: string) => {
    setRangeDraft((prev) => setScheduleEditStartDate(prev, value))
  }
  const setStartTime = (value: string) => {
    setRangeDraft((prev) => setScheduleEditStartTime(prev, value))
  }
  const setEndTime = (value: string) => {
    setRangeDraft((prev) => setScheduleEditEndTime(prev, value))
  }
  const setRemindBeforeMinutes = (value: number | '') => {
    reminderTouchedRef.current = true
    setRemindBeforeMinutesState(value)
  }

  const canSubmit = Boolean(
    ((schedule && scope !== 'all') || title.trim()) &&
    startDate &&
    startTime &&
    endTime &&
    (scope !== 'all' || !schedule || scheduleDetails.data) &&
    (previewRequest == null ||
      (previewQuery.isSuccess && previewQuery.data != null)),
  )
  const previewText =
    previewRequest == null
      ? scope === 'following' &&
        rangeAction === 'endSeries' &&
        previousScheduleDate(rangeDraft.following.fromDate) <
          (schedule?.startDate ?? '')
        ? 'Ending the series before its first occurrence removes the schedule.'
        : null
      : previewQuery.data == null
        ? null
        : describeSchedulePreview(
            previewQuery.data,
            scope,
            rangeAction,
            scope === 'this'
              ? rangeDraft.thisEvent.date
              : rangeDraft.following.fromDate,
          )

  const panelProps: SchedulePanelProps = {
    schedule,
    handleOpenChange,
    scope,
    setScope,
    occurrenceDate,
    rangeAction,
    setRangeAction,
    canRestoreThisEvent,
    canEditTitle: !schedule || scope === 'all',
    canEditSeriesDetails: scope !== 'this',
    title,
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
    context,
    setContext,
    color,
    setColor,
    exceptions: exceptionQuery.data ?? [],
    isExceptionsLoading: exceptionQuery.isLoading,
    onRestoreException: handleRestoreException,
    isRestorePending: clearScheduleOverride.isPending,
    remindBeforeMinutes,
    setRemindBeforeMinutes,
    reminderReady: !schedule || scheduleDetails.data != null,
    previewText,
    isPreviewLoading: previewQuery.isFetching && previewRequest != null,
    previewError:
      previewRequest != null &&
      (previewQuery.isError ||
        (previewQuery.isSuccess && previewQuery.data == null)),
    onDelete: handleDelete,
    isPending,
    canSubmit,
    handleSubmit,
  }

  return { panelProps, handleSubmit }
}
