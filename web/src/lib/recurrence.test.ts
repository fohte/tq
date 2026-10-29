import { err, ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import {
  anchorDateForFirstOccurrence,
  computeNextOccurrence,
  formatRecurrenceSummary,
  parseRecurrenceInterval,
} from '#lib/recurrence'

describe('formatRecurrenceSummary', () => {
  describe('daily', () => {
    it('formats interval 1', () => {
      expect(formatRecurrenceSummary({ type: 'daily', interval: 1 })).toBe(
        'Daily',
      )
    })

    it('formats interval greater than 1', () => {
      expect(formatRecurrenceSummary({ type: 'daily', interval: 3 })).toBe(
        'Every 3 days',
      )
    })
  })

  describe('weekly', () => {
    it('formats with no days set', () => {
      expect(
        formatRecurrenceSummary({
          type: 'weekly',
          interval: 1,
          daysOfWeek: null,
        }),
      ).toBe('Weekly')
    })

    it('formats a single day', () => {
      expect(
        formatRecurrenceSummary({
          type: 'weekly',
          interval: 1,
          daysOfWeek: [3],
        }),
      ).toBe('Weekly · Wed')
    })

    it('sorts multiple days in the label regardless of input order', () => {
      expect(
        formatRecurrenceSummary({
          type: 'weekly',
          interval: 1,
          daysOfWeek: [3, 0],
        }),
      ).toBe('Weekly · Sun, Wed')
    })

    it('formats interval greater than 1', () => {
      expect(
        formatRecurrenceSummary({
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1, 3],
        }),
      ).toBe('Every 2 weeks · Mon, Wed')
    })
  })

  describe('monthly', () => {
    it('formats with no day set', () => {
      expect(
        formatRecurrenceSummary({
          type: 'monthly',
          interval: 1,
          dayOfMonth: null,
        }),
      ).toBe('Monthly')
    })

    it('formats with a day set', () => {
      expect(
        formatRecurrenceSummary({
          type: 'monthly',
          interval: 1,
          dayOfMonth: 15,
        }),
      ).toBe('Monthly · 15th')
    })

    it('formats interval greater than 1', () => {
      expect(
        formatRecurrenceSummary({
          type: 'monthly',
          interval: 2,
          dayOfMonth: 10,
        }),
      ).toBe('Every 2 months · 10th')
    })

    it.each([
      [1, '1st'],
      [2, '2nd'],
      [3, '3rd'],
      [4, '4th'],
      [11, '11th'],
      [12, '12th'],
      [13, '13th'],
      [21, '21st'],
      [22, '22nd'],
      [23, '23rd'],
      [31, '31st'],
    ])('formats day %i with ordinal suffix %s', (day, expected) => {
      expect(
        formatRecurrenceSummary({
          type: 'monthly',
          interval: 1,
          dayOfMonth: day,
        }),
      ).toBe(`Monthly · ${expected}`)
    })
  })

  describe('custom', () => {
    it('formats interval 1', () => {
      expect(formatRecurrenceSummary({ type: 'custom', interval: 1 })).toBe(
        'Custom',
      )
    })

    it('formats interval greater than 1', () => {
      expect(formatRecurrenceSummary({ type: 'custom', interval: 3 })).toBe(
        'Custom · every 3 days',
      )
    })
  })
})

describe('parseRecurrenceInterval', () => {
  it.each([
    ['1', 1],
    ['12', 12],
    ['1.5', null],
    ['1x', null],
    ['9007199254740992', null],
  ])('parses %s as %s', (input, expected) => {
    expect(parseRecurrenceInterval(input)).toEqual(expected)
  })
})

// computeNextOccurrence is a thin `computeNextDate(...).unwrapOr(null)`
// wrapper (web/src/lib/recurrence.ts) — the date-math branch matrix itself
// (weekly wrap/skip, monthly end-of-month clamping, ...) is already covered
// by api/src/services/recurrence.test.ts, so these only pin the wrapper's
// own contract: it delegates and unwraps rather than re-verifying every
// branch a second time.
describe('computeNextOccurrence', () => {
  it('delegates to computeNextDate and unwraps the result', () => {
    expect(
      computeNextOccurrence('2026-03-20', { type: 'daily', interval: 1 }),
    ).toBe('2026-03-21')
  })

  it('passes the monthly end-of-month clamp through unchanged', () => {
    expect(
      computeNextOccurrence('2026-01-31', {
        type: 'monthly',
        interval: 1,
        dayOfMonth: 31,
      }),
    ).toBe('2026-02-28')
  })
})

describe('anchorDateForFirstOccurrence', () => {
  function convert(
    firstDate: string,
    rule: Parameters<typeof anchorDateForFirstOccurrence>[1],
  ) {
    return anchorDateForFirstOccurrence(firstDate, rule).map(
      ({ anchorDate, recurrenceRule }) => ({
        anchorDate,
        recurrenceRule,
        nextDate: computeNextOccurrence(anchorDate, recurrenceRule),
      }),
    )
  }

  it('finds the previous interval for a daily rule with interval greater than one', () => {
    expect(convert('2026-03-25', { type: 'daily', interval: 2 })).toEqual(
      ok({
        anchorDate: '2026-03-23',
        recurrenceRule: { type: 'daily', interval: 2 },
        nextDate: '2026-03-25',
      }),
    )
  })

  it('anchors a biweekly Monday recurrence on the preceding Sunday', () => {
    expect(
      convert('2026-03-30', {
        type: 'weekly',
        interval: 2,
        daysOfWeek: [1],
      }),
    ).toEqual(
      ok({
        anchorDate: '2026-03-29',
        recurrenceRule: { type: 'weekly', interval: 2, daysOfWeek: [1] },
        nextDate: '2026-03-30',
      }),
    )
  })

  it('fills an omitted weekly weekday from the first date', () => {
    expect(convert('2026-03-30', { type: 'weekly', interval: 2 })).toEqual(
      ok({
        anchorDate: '2026-03-29',
        recurrenceRule: { type: 'weekly', interval: 2, daysOfWeek: [1] },
        nextDate: '2026-03-30',
      }),
    )
  })

  it('finds the previous monthly anchor for a 31st rule clamped to February', () => {
    expect(
      convert('2026-02-28', {
        type: 'monthly',
        interval: 1,
        dayOfMonth: 31,
      }),
    ).toEqual(
      ok({
        anchorDate: '2026-01-31',
        recurrenceRule: { type: 'monthly', interval: 1, dayOfMonth: 31 },
        nextDate: '2026-02-28',
      }),
    )
  })

  it('fills an omitted monthly day from the first date', () => {
    expect(convert('2026-03-30', { type: 'monthly', interval: 1 })).toEqual(
      ok({
        anchorDate: '2026-02-28',
        recurrenceRule: { type: 'monthly', interval: 1, dayOfMonth: 30 },
        nextDate: '2026-03-30',
      }),
    )
  })

  it('rejects a first date that does not match the selected weekday', () => {
    expect(
      anchorDateForFirstOccurrence('2026-03-23', {
        type: 'weekly',
        interval: 1,
        daysOfWeek: [2],
      }),
    ).toEqual(err('The first date does not match the recurrence rule.'))
  })
})
