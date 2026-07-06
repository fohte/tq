import { getDayIsoRange } from '@web/lib/date-range'
import { describe, expect, it } from 'vitest'

describe('getDayIsoRange', () => {
  it('returns the UTC ISO range for local midnight to midnight of the given date', () => {
    expect(getDayIsoRange('2026-07-07')).toEqual({
      timeMin: new Date(2026, 6, 7).toISOString(),
      timeMax: new Date(2026, 6, 8).toISOString(),
    })
  })

  it('handles month boundaries', () => {
    expect(getDayIsoRange('2026-07-31')).toEqual({
      timeMin: new Date(2026, 6, 31).toISOString(),
      timeMax: new Date(2026, 7, 1).toISOString(),
    })
  })
})
