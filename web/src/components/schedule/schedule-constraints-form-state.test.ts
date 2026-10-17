import { describe, expect, it } from 'vitest'

import type { ScheduleConstraintFormState } from '#components/schedule/schedule-constraints-form-state'
import {
  cycleScheduleConstraintWeekdayPreference,
  emptyScheduleConstraintFormState,
  scheduleConstraintFormStateError,
  scheduleConstraintFormStateFromSaved,
  scheduleConstraintInputFromFormState,
  scheduleConstraintsMatchSaved,
  scheduleConstraintSummary,
} from '#components/schedule/schedule-constraints-form-state'
import { makeScheduleConstraint } from '#components/schedule/schedule-test-fixtures'

describe('schedule constraint form state', () => {
  it('hydrates sparse weekday settings into seven editable cells', () => {
    expect(
      scheduleConstraintFormStateFromSaved(
        makeScheduleConstraint({
          weekdays: [
            { dayOfWeek: 1, preference: 'reserve' },
            { dayOfWeek: 5, preference: 'excluded' },
          ],
        }),
      ),
    ).toEqual({
      weeklyMin: '3',
      weeklyMax: '4',
      weeklyTarget: '4',
      maxConsecutiveDays: '2',
      windowStart: '',
      windowEnd: '',
      weekdays: [
        'preferred',
        'reserve',
        'preferred',
        'preferred',
        'preferred',
        'excluded',
        'preferred',
      ],
    })
  })

  it('saves configured values and omits preferred weekdays', () => {
    const form: ScheduleConstraintFormState = {
      ...emptyScheduleConstraintFormState(),
      weeklyMin: '3',
      weeklyMax: '4',
      weeklyTarget: '4',
      maxConsecutiveDays: '2',
      windowStart: '20:30',
      windowEnd: '22:00',
      weekdays: [
        'preferred',
        'reserve',
        'if_free',
        'preferred',
        'preferred',
        'excluded',
        'preferred',
      ],
    }

    expect(scheduleConstraintInputFromFormState(form)).toEqual({
      weeklyMin: 3,
      weeklyMax: 4,
      weeklyTarget: 4,
      maxConsecutiveDays: 2,
      windowStart: '20:30',
      windowEnd: '22:00',
      weekdays: [
        { dayOfWeek: 1, preference: 'reserve' },
        { dayOfWeek: 2, preference: 'if_free' },
        { dayOfWeek: 5, preference: 'excluded' },
      ],
    })
  })

  it('cycles weekday preferences in the designed order', () => {
    expect(
      Array.of(
        cycleScheduleConstraintWeekdayPreference('preferred'),
        cycleScheduleConstraintWeekdayPreference('if_free'),
        cycleScheduleConstraintWeekdayPreference('reserve'),
        cycleScheduleConstraintWeekdayPreference('excluded'),
      ),
    ).toEqual(['if_free', 'reserve', 'excluded', 'preferred'])
  })

  it('reports invalid weekly counts, targets, and incomplete windows', () => {
    const invalidForms = [
      { ...emptyScheduleConstraintFormState(), weeklyMin: '8' },
      {
        ...emptyScheduleConstraintFormState(),
        weeklyMin: '5',
        weeklyMax: '3',
      },
      {
        ...emptyScheduleConstraintFormState(),
        weeklyTarget: '3',
        weeklyMax: '2',
      },
      { ...emptyScheduleConstraintFormState(), maxConsecutiveDays: '0' },
      { ...emptyScheduleConstraintFormState(), windowStart: '08:00' },
    ]

    expect(invalidForms.map(scheduleConstraintFormStateError)).toEqual([
      'Use whole numbers from 0 to 7 for weekly counts.',
      'Minimum per week cannot exceed the maximum.',
      'Target must be within the weekly range.',
      'Use a whole number of at least 1 for consecutive days.',
      'Set both window times.',
    ])
  })

  it('does not match an invalid draft to an empty saved constraint', () => {
    expect(
      scheduleConstraintsMatchSaved(
        { ...emptyScheduleConstraintFormState(), weeklyMin: '8' },
        null,
      ),
    ).toEqual(false)
  })

  it('summarizes the configured values for a mobile chip', () => {
    const form = scheduleConstraintFormStateFromSaved(makeScheduleConstraint())

    expect(form === null ? null : scheduleConstraintSummary(form)).toEqual(
      '3–4/wk · max 2 in a row',
    )
  })
})
