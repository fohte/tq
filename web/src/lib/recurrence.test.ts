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

describe('computeNextOccurrence', () => {
  describe('daily', () => {
    it('advances by interval 1', () => {
      expect(
        computeNextOccurrence('2026-03-20', { type: 'daily', interval: 1 }),
      ).toBe('2026-03-21')
    })

    it('advances by interval greater than 1', () => {
      expect(
        computeNextOccurrence('2026-03-20', { type: 'daily', interval: 5 }),
      ).toBe('2026-03-25')
    })
  })

  describe('weekly', () => {
    it('advances by interval weeks when no days are set', () => {
      // 2026-03-16 is a Monday.
      expect(
        computeNextOccurrence('2026-03-16', {
          type: 'weekly',
          interval: 1,
          daysOfWeek: null,
        }),
      ).toBe('2026-03-23')
    })

    it('finds the next matching day within the current week', () => {
      // 2026-03-16 (Mon) -> next Wed is later the same week.
      expect(
        computeNextOccurrence('2026-03-16', {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [3],
        }),
      ).toBe('2026-03-18')
    })

    it('wraps to the following week when no matching day remains', () => {
      // 2026-03-18 (Wed) with Sun/Wed selected has no later match this
      // week, so it wraps to the following Sunday.
      expect(
        computeNextOccurrence('2026-03-18', {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [3, 0],
        }),
      ).toBe('2026-03-22')
    })

    it('skips to the interval-th week when no matching day remains this week', () => {
      // 2026-03-18 (Wed) with only Monday selected and interval 2 has no
      // later match this week, so it skips one whole extra week.
      expect(
        computeNextOccurrence('2026-03-18', {
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1],
        }),
      ).toBe('2026-03-30')
    })
  })

  describe('monthly', () => {
    it('uses the base date day when no day is set', () => {
      expect(
        computeNextOccurrence('2026-03-16', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: null,
        }),
      ).toBe('2026-04-16')
    })

    it('uses the given day of month', () => {
      expect(
        computeNextOccurrence('2026-03-16', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 15,
        }),
      ).toBe('2026-04-15')
    })

    it('advances by interval months', () => {
      expect(
        computeNextOccurrence('2026-01-05', {
          type: 'monthly',
          interval: 2,
          dayOfMonth: 10,
        }),
      ).toBe('2026-03-10')
    })

    it('clamps to the last day of a 28-day February', () => {
      expect(
        computeNextOccurrence('2026-01-31', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 31,
        }),
      ).toBe('2026-02-28')
    })

    it('clamps to the last day of a 29-day leap-year February', () => {
      expect(
        computeNextOccurrence('2024-01-31', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 31,
        }),
      ).toBe('2024-02-29')
    })

    it('clamps to the last day of a 30-day month', () => {
      expect(
        computeNextOccurrence('2026-03-31', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 31,
        }),
      ).toBe('2026-04-30')
    })
  })

  describe('custom', () => {
    it('advances by interval days, same as daily', () => {
      expect(
        computeNextOccurrence('2026-03-20', { type: 'custom', interval: 3 }),
      ).toBe('2026-03-23')
    })
  })
})
