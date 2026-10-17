import type { Schedule, ScheduleOverride } from '#hooks/use-schedules'

export function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    scheduleId: 'schedule-1',
    title: 'Gym',
    startDate: '2026-01-01',
    start: '2026-01-01T07:00:00',
    end: '2026-01-01T08:00:00',
    occurrenceDate: '2026-01-01',
    overridden: null,
    remindBeforeMinutes: null,
    context: 'personal',
    color: '#6C63FF',
    recurrence: {
      id: 'rule-1',
      type: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5],
      dayOfMonth: null,
    },
    ...overrides,
    occurrenceStartDate:
      overrides.occurrenceStartDate ??
      overrides.start?.slice(0, 10) ??
      overrides.occurrenceDate ??
      '2026-01-01',
    occurrenceStartTime:
      overrides.occurrenceStartTime ??
      overrides.start?.slice(11, 16) ??
      '07:00',
    occurrenceEndTime:
      overrides.occurrenceEndTime ?? overrides.end?.slice(11, 16) ?? '08:00',
  }
}

export function makeScheduleOverride(
  overrides: Partial<ScheduleOverride> = {},
): ScheduleOverride {
  return {
    occurrenceDate: '2026-01-03',
    movedToDate: null,
    skipped: true,
    ...overrides,
  }
}
