import { createScheduleEditDraft } from '#components/schedule/schedule-edit-dialog-state'
import type { RecurrenceType } from '#components/schedule/schedule-modal-form-options'
import { scheduleRecurrenceType } from '#components/schedule/schedule-modal-form-utils'
import type { Schedule, ScheduleDetails } from '#hooks/use-schedules'

export interface RecurrenceFormDraft {
  type: RecurrenceType | ''
  interval: number
  daysOfWeek: number[]
  dayOfMonth: string
}

export function recurrenceFormFromSchedule(
  schedule: Schedule | undefined,
): RecurrenceFormDraft {
  return {
    type: scheduleRecurrenceType(schedule),
    interval: schedule?.recurrence?.interval ?? 1,
    daysOfWeek: schedule?.recurrence?.daysOfWeek ?? [],
    dayOfMonth:
      schedule?.recurrence?.dayOfMonth != null
        ? String(schedule.recurrence.dayOfMonth)
        : '',
  }
}

export function recurrenceFormFromDetails(
  details: ScheduleDetails,
): RecurrenceFormDraft {
  const type = details.recurrence?.type
  return {
    type:
      type === 'daily' ||
      type === 'weekly' ||
      type === 'monthly' ||
      type === 'custom'
        ? type
        : '',
    interval: details.recurrence?.interval ?? 1,
    daysOfWeek: details.recurrence?.daysOfWeek ?? [],
    dayOfMonth:
      details.recurrence?.dayOfMonth != null
        ? String(details.recurrence.dayOfMonth)
        : '',
  }
}

export function draftWithScheduleDetails(
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
