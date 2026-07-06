import { getDayIsoRange } from '@web/lib/date-range'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('getDayIsoRange', () => {
  const originalTz = process.env['TZ']

  beforeAll(() => {
    process.env['TZ'] = 'Asia/Tokyo'
  })

  afterAll(() => {
    process.env['TZ'] = originalTz
  })

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
