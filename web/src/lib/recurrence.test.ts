import { describe, expect, it } from 'vitest'

import { computeNextOccurrence, formatRecurrenceSummary } from '#lib/recurrence'

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
