import type {
  ContextValue,
  RecurrenceType,
} from '#components/schedule/schedule-modal-form-options'
import type { Schedule, UpdateScheduleInput } from '#hooks/use-schedules'

export function scheduleTimeOfDay(isoDateTime: string) {
  // Cross-midnight blocks expose 00:00 for the segment after midnight.
  return isoDateTime.slice(11, 16)
}

export function scheduleContext(
  schedule: Schedule | undefined,
): ContextValue | '' {
  if (schedule?.context === 'work' || schedule?.context === 'personal') {
    return schedule.context
  }
  return ''
}

export function scheduleRecurrenceType(
  schedule: Schedule | undefined,
): RecurrenceType | '' {
  const type = schedule?.recurrence?.type
  return type === 'daily' ||
    type === 'weekly' ||
    type === 'monthly' ||
    type === 'custom'
    ? type
    : ''
}

export function sameRecurrence(
  current: Schedule['recurrence'],
  next: NonNullable<UpdateScheduleInput['recurrence']> | null,
) {
  if (current == null || next == null) return current == null && next == null

  const currentDays = [...(current.daysOfWeek ?? [])].sort()
  const nextDays = [...(next.daysOfWeek ?? [])].sort()
  return (
    current.type === next.type &&
    current.interval === next.interval &&
    current.dayOfMonth === (next.dayOfMonth ?? null) &&
    currentDays.length === nextDays.length &&
    currentDays.every((day, index) => day === nextDays[index])
  )
}
