import type { ScheduleEditDraft } from '#components/schedule/schedule-edit-dialog-state'
import type { ContextValue } from '#components/schedule/schedule-modal-form-options'
import {
  sameRecurrence,
  scheduleContext,
  scheduleTimeOfDay,
} from '#components/schedule/schedule-modal-form-utils'
import type {
  Schedule,
  ScheduleDetails,
  UpdateScheduleInput,
} from '#hooks/use-schedules'

type ScheduleRecurrenceInput = Exclude<
  UpdateScheduleInput['recurrence'],
  undefined
>

export function buildFollowingScheduleInput(
  schedule: Schedule | undefined,
  draft: ScheduleEditDraft,
  recurrence: ScheduleRecurrenceInput,
): UpdateScheduleInput {
  if (!schedule) return {}
  return {
    effectiveFrom: draft.following.fromDate,
    ...(draft.following.startTime !== scheduleTimeOfDay(schedule.start)
      ? { startTime: draft.following.startTime }
      : {}),
    ...(draft.following.endTime !== scheduleTimeOfDay(schedule.end)
      ? { endTime: draft.following.endTime }
      : {}),
    ...(!sameRecurrence(schedule.recurrence, recurrence) ? { recurrence } : {}),
  }
}

export function buildAllScheduleInput({
  schedule,
  draft,
  recurrence,
  title,
  context,
  color,
  remindBeforeMinutes,
  currentReminder,
  currentDetails,
}: {
  schedule: Schedule | undefined
  draft: ScheduleEditDraft
  recurrence: ScheduleRecurrenceInput
  title: string
  context: ContextValue | ''
  color: string
  remindBeforeMinutes: number | ''
  currentReminder: number | null
  currentDetails: ScheduleDetails | undefined
}): UpdateScheduleInput {
  if (!schedule) return {}
  const currentStartDate = currentDetails?.startDate ?? schedule.startDate
  const currentStartTime =
    currentDetails?.startTime ?? scheduleTimeOfDay(schedule.start)
  const currentEndTime =
    currentDetails?.endTime ?? scheduleTimeOfDay(schedule.end)
  const currentRecurrence = currentDetails
    ? currentDetails.recurrence
    : schedule.recurrence
  return {
    ...(title.trim() !== (currentDetails?.title ?? schedule.title)
      ? { title: title.trim() }
      : {}),
    ...(draft.all.startDate !== currentStartDate
      ? { startDate: draft.all.startDate }
      : {}),
    ...(draft.all.startTime !== currentStartTime
      ? { startTime: draft.all.startTime }
      : {}),
    ...(draft.all.endTime !== currentEndTime
      ? { endTime: draft.all.endTime }
      : {}),
    ...(!sameRecurrence(currentRecurrence, recurrence) ? { recurrence } : {}),
    ...(context !== (currentDetails?.context ?? scheduleContext(schedule))
      ? { context: context || null }
      : {}),
    ...(color !== (currentDetails?.color ?? schedule.color ?? '')
      ? { color: color || null }
      : {}),
    ...((remindBeforeMinutes === '' ? null : remindBeforeMinutes) !==
    currentReminder
      ? {
          remindBeforeMinutes:
            remindBeforeMinutes === '' ? null : remindBeforeMinutes,
        }
      : {}),
  }
}

export function previousScheduleDate(date: string) {
  const previous = new Date(`${date}T00:00:00`)
  previous.setDate(previous.getDate() - 1)
  const year = String(previous.getFullYear())
  const month = String(previous.getMonth() + 1).padStart(2, '0')
  const day = String(previous.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
