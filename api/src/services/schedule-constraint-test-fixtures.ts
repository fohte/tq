import type { ScheduleConstraint } from '#services/schedule-constraints'

export function makeScheduleConstraint(
  overrides: Partial<ScheduleConstraint> = {},
): ScheduleConstraint {
  return {
    weeklyMin: null,
    weeklyMax: null,
    weeklyTarget: null,
    maxConsecutiveDays: null,
    windowStart: null,
    windowEnd: null,
    weekdays: [],
    ...overrides,
  }
}
