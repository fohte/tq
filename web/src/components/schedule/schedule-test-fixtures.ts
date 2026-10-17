import type {
  Schedule,
  ScheduleConstraint,
  ScheduleConstraintCheckResponse,
  ScheduleOverride,
} from '#hooks/use-schedules'

type ScheduleConstraintViolation =
  ScheduleConstraintCheckResponse['constraintViolations'][number]

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

export function makeScheduleConstraint(
  overrides: Partial<ScheduleConstraint> = {},
): ScheduleConstraint {
  return {
    weeklyMin: 3,
    weeklyMax: 4,
    weeklyTarget: 4,
    maxConsecutiveDays: 2,
    windowStart: null,
    windowEnd: null,
    weekdays: [
      { dayOfWeek: 2, preference: 'if_free' },
      { dayOfWeek: 5, preference: 'excluded' },
    ],
    ...overrides,
  }
}

export function makeScheduleConstraintViolations(): ScheduleConstraintViolation[] {
  return [
    {
      type: 'weekly-count-below-minimum',
      severity: 'required',
      date: '2041-05-14',
      weekStart: '2041-05-13',
      count: 2,
      minimum: 5,
    },
    {
      type: 'weekly-count-above-maximum',
      severity: 'required',
      date: '2041-05-14',
      weekStart: '2041-05-13',
      count: 6,
      maximum: 5,
    },
    {
      type: 'weekly-target-not-met',
      severity: 'preferred',
      date: '2041-05-14',
      weekStart: '2041-05-13',
      count: 4,
      target: 6,
    },
    {
      type: 'excluded-weekday',
      severity: 'required',
      date: '2041-05-16',
      originalDate: '2041-05-15',
    },
    {
      type: 'reserve-weekday',
      severity: 'preferred',
      date: '2041-05-17',
    },
    {
      type: 'consecutive-days-exceeded',
      severity: 'required',
      date: '2041-05-14',
      consecutiveDays: 3,
      maximum: 2,
      dates: ['2041-05-14', '2041-05-15', '2041-05-16'],
    },
    {
      type: 'outside-time-window',
      severity: 'required',
      date: '2041-05-15',
      startTime: '06:30',
      endTime: '07:30',
      windowStart: '07:00',
      windowEnd: '08:00',
    },
    {
      type: 'if-free-overlap',
      severity: 'required',
      date: '2041-05-17',
      overlap: {
        date: '2041-05-17',
        startTime: '07:00',
        endTime: '07:30',
      },
    },
  ]
}
