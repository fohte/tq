import { describe, expect, it } from 'vitest'

import { getDaysRemaining } from '#components/project/project-detail-utils'

describe('getDaysRemaining', () => {
  it('returns positive days for a future target date', () => {
    expect(
      getDaysRemaining('2024-12-08', new Date('2024-11-15T09:00:00')),
    ).toBe(23)
  })

  it('returns 0 when the target date is today', () => {
    expect(
      getDaysRemaining('2024-11-15', new Date('2024-11-15T23:00:00')),
    ).toBe(0)
  })

  it('returns a negative number for a past target date', () => {
    expect(
      getDaysRemaining('2024-11-01', new Date('2024-11-15T00:00:00')),
    ).toBe(-14)
  })
})
