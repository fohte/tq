import { createScheduleEditDraft } from '#components/schedule/schedule-edit-dialog-state'
import type {
  ContextValue,
  RecurrenceType,
} from '#components/schedule/schedule-modal-form-options'
import {
  scheduleContext,
  scheduleRecurrenceType,
} from '#components/schedule/schedule-modal-form-utils'
import type { Schedule, ScheduleDetails } from '#hooks/use-schedules'

export interface ScheduleEditFormState {
  rangeDraft: ReturnType<typeof draftWithScheduleDetails>
  title: string
  followingRecurrence: RecurrenceFormDraft
  allRecurrence: RecurrenceFormDraft
  context: ContextValue | ''
  color: string
  remindBeforeMinutes: number | ''
}

export interface RecurrenceFormDraft {
  type: RecurrenceType | ''
  interval: number
  daysOfWeek: number[]
  dayOfMonth: string
}

function recurrenceFormFromSchedule(
  schedule: Schedule | undefined,
): RecurrenceFormDraft {
  return recurrenceFormFromRecurrence(schedule?.recurrence)
}

function recurrenceFormFromRecurrence(
  recurrence: Schedule['recurrence'] | undefined,
): RecurrenceFormDraft {
  return {
    type: scheduleRecurrenceType(recurrence),
    interval: recurrence?.interval ?? 1,
    daysOfWeek: recurrence?.daysOfWeek ?? [],
    dayOfMonth:
      recurrence?.dayOfMonth != null ? String(recurrence.dayOfMonth) : '',
  }
}

function recurrenceFormFromDetails(
  details: ScheduleDetails,
): RecurrenceFormDraft {
  return recurrenceFormFromRecurrence(details.recurrence)
}

function draftWithScheduleDetails(
  schedule: Schedule | undefined,
  defaultStartDate: string,
  details: ScheduleDetails | undefined,
) {
  const draft = createScheduleEditDraft(schedule, defaultStartDate)
  if (!details) return draft
  return {
    ...draft,
    all: {
      startDate: details.startDate,
      startTime: details.startTime,
      endTime: details.endTime,
    },
  }
}

export function scheduleEditDialogFormState(
  schedule: Schedule | undefined,
  defaultStartDate: string,
  details: ScheduleDetails | undefined,
): ScheduleEditFormState {
  return {
    rangeDraft: draftWithScheduleDetails(schedule, defaultStartDate, details),
    title: details?.title ?? schedule?.title ?? '',
    followingRecurrence: recurrenceFormFromSchedule(schedule),
    allRecurrence: details
      ? recurrenceFormFromDetails(details)
      : recurrenceFormFromSchedule(schedule),
    context: details?.context ?? scheduleContext(schedule),
    color: details?.color ?? schedule?.color ?? '',
    remindBeforeMinutes: details?.remindBeforeMinutes ?? '',
  }
}
