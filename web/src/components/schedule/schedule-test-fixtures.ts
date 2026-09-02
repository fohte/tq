import type { Schedule } from '#hooks/use-schedules'

export function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    scheduleId: 'schedule-1',
    title: 'Gym',
    start: '2026-01-01T07:00:00',
    end: '2026-01-01T08:00:00',
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
