import { getDayIsoRange } from '@web/lib/date-range'
import { describe, expect, it } from 'vitest'

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
