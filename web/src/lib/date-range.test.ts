import { describe, expect, it } from 'vitest'

import { formatWeekRangeLabel, getDayIsoRange } from '#lib/date-range'

// vitest.config.ts pins TZ to Asia/Tokyo (JST, UTC+9) for the unit project.
describe('getDayIsoRange', () => {
  it('returns the UTC ISO range for local midnight to midnight of the given date', () => {
    expect(getDayIsoRange('2026-07-07')).toEqual({
      timeMin: '2026-07-06T15:00:00.000Z',
      timeMax: '2026-07-07T15:00:00.000Z',
    })
  })

  it('handles month boundaries', () => {
    expect(getDayIsoRange('2026-07-31')).toEqual({
      timeMin: '2026-07-30T15:00:00.000Z',
      timeMax: '2026-07-31T15:00:00.000Z',
    })
  })
})

describe('formatWeekRangeLabel', () => {
  it('returns the Monday-to-Sunday range for a mid-week date', () => {
    expect(formatWeekRangeLabel(new Date(2026, 2, 18))).toBe('03-16 – 03-22')
  })

  it('returns the same week for a Sunday, the last day of the week', () => {
    expect(formatWeekRangeLabel(new Date(2026, 2, 22))).toBe('03-16 – 03-22')
  })
})
