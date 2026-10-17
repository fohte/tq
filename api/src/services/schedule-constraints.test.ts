import { describe, expect, it } from 'vitest'

import {
  checkScheduleConstraints,
  type ScheduleConstraint,
  type ScheduleConstraintOccurrence,
  scheduleConstraintSchema,
} from '#services/schedule-constraints'

function makeConstraint(
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

function makeOccurrence(
  date: string,
  overrides: Partial<ScheduleConstraintOccurrence> = {},
): ScheduleConstraintOccurrence {
  return {
    date,
    originalDate: date,
    startTime: '18:00',
    endTime: '19:00',
    skipped: false,
    ...overrides,
  }
}

describe('scheduleConstraintSchema', () => {
  it('rejects a target outside the weekly count range', () => {
    const result = scheduleConstraintSchema.safeParse({
      ...makeConstraint(),
      weeklyMin: 3,
      weeklyMax: 4,
      weeklyTarget: 2,
    })

    expect(result.success).toEqual(false)
  })

  it('rejects a time window with only one boundary', () => {
    const result = scheduleConstraintSchema.safeParse({
      ...makeConstraint(),
      windowStart: '18:00',
    })

    expect(result.success).toEqual(false)
  })
})

describe('checkScheduleConstraints', () => {
  it('counts a streak across Sunday and Monday as consecutive days', () => {
    expect(
      checkScheduleConstraints(makeConstraint({ maxConsecutiveDays: 2 }), [
        makeOccurrence('2030-05-11'),
        makeOccurrence('2030-05-12'),
        makeOccurrence('2030-05-13', { originalDate: '2030-05-09' }),
      ]),
    ).toEqual([
      {
        type: 'consecutive-days-exceeded',
        severity: 'required',
        date: '2030-05-13',
        originalDate: '2030-05-09',
        consecutiveDays: 3,
        maximum: 2,
        dates: ['2030-05-11', '2030-05-12', '2030-05-13'],
      },
    ])
  })

  it('reports an excluded destination weekday and its original date', () => {
    expect(
      checkScheduleConstraints(
        makeConstraint({
          weekdays: [{ dayOfWeek: 5, preference: 'excluded' }],
        }),
        [
          makeOccurrence('2030-05-10', {
            originalDate: '2030-05-09',
          }),
        ],
      ),
    ).toEqual([
      {
        type: 'excluded-weekday',
        severity: 'required',
        date: '2030-05-10',
        originalDate: '2030-05-09',
      },
    ])
  })

  it('reports a required violation when the weekly count is below its minimum', () => {
    expect(
      checkScheduleConstraints(makeConstraint({ weeklyMin: 3 }), [
        makeOccurrence('2030-05-06'),
        makeOccurrence('2030-05-08', { skipped: true }),
        makeOccurrence('2030-05-11'),
      ]),
    ).toEqual([
      {
        type: 'weekly-count-below-minimum',
        severity: 'required',
        date: '2030-05-06',
        weekStart: '2030-05-06',
        count: 2,
        minimum: 3,
      },
    ])
  })

  it('reports a preferred violation when a count is in range but below target', () => {
    expect(
      checkScheduleConstraints(
        makeConstraint({ weeklyMin: 2, weeklyMax: 4, weeklyTarget: 4 }),
        [
          makeOccurrence('2030-05-06'),
          makeOccurrence('2030-05-08'),
          makeOccurrence('2030-05-10'),
        ],
      ),
    ).toEqual([
      {
        type: 'weekly-target-not-met',
        severity: 'preferred',
        date: '2030-05-06',
        weekStart: '2030-05-06',
        count: 3,
        target: 4,
      },
    ])
  })

  it('reports use of a reserve weekday as a preferred violation', () => {
    expect(
      checkScheduleConstraints(
        makeConstraint({ weekdays: [{ dayOfWeek: 2, preference: 'reserve' }] }),
        [makeOccurrence('2030-05-07')],
      ),
    ).toEqual([
      {
        type: 'reserve-weekday',
        severity: 'preferred',
        date: '2030-05-07',
      },
    ])
  })

  it('reports an overlap on an if-free weekday', () => {
    expect(
      checkScheduleConstraints(
        makeConstraint({ weekdays: [{ dayOfWeek: 2, preference: 'if_free' }] }),
        [
          makeOccurrence('2030-05-07', {
            startTime: '21:00',
            endTime: '22:30',
          }),
        ],
        [{ date: '2030-05-07', startTime: '22:00', endTime: '23:00' }],
      ),
    ).toEqual([
      {
        type: 'if-free-overlap',
        severity: 'required',
        date: '2030-05-07',
        overlap: {
          date: '2030-05-07',
          startTime: '22:00',
          endTime: '23:00',
        },
      },
    ])
  })

  it('reports an occurrence that extends beyond its time window', () => {
    expect(
      checkScheduleConstraints(
        makeConstraint({ windowStart: '18:00', windowEnd: '19:00' }),
        [
          makeOccurrence('2030-05-07', {
            startTime: '17:30',
            endTime: '18:30',
          }),
        ],
      ),
    ).toEqual([
      {
        type: 'outside-time-window',
        severity: 'required',
        date: '2030-05-07',
        startTime: '17:30',
        endTime: '18:30',
        windowStart: '18:00',
        windowEnd: '19:00',
      },
    ])
  })

  it('reports a required violation when the weekly count exceeds its maximum', () => {
    expect(
      checkScheduleConstraints(makeConstraint({ weeklyMax: 2 }), [
        makeOccurrence('2030-05-06'),
        makeOccurrence('2030-05-08'),
        makeOccurrence('2030-05-10'),
      ]),
    ).toEqual([
      {
        type: 'weekly-count-above-maximum',
        severity: 'required',
        date: '2030-05-10',
        weekStart: '2030-05-06',
        count: 3,
        maximum: 2,
      },
    ])
  })

  it('counts a moved occurrence in the week of its destination date', () => {
    expect(
      checkScheduleConstraints(makeConstraint({ weeklyMin: 2 }), [
        makeOccurrence('2030-05-13', { originalDate: '2030-05-12' }),
        makeOccurrence('2030-05-15'),
      ]),
    ).toEqual([])
  })
})
