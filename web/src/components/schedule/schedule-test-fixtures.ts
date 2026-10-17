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
  }
}

export function makeScheduleOverride(
  overrides: Partial<ScheduleOverride> = {},
): ScheduleOverride {
  return {
    scheduleId: 'schedule-1',
    occurrenceDate: '2026-01-03',
    startTime: null,
    endTime: null,
    movedToDate: null,
    skipped: true,
    ...overrides,
  }
}
