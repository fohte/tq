import { describe, expect, it } from 'vitest'

import { estimateMinutesForRange } from '#components/day-view/day-view'

describe('estimateMinutesForRange', () => {
  it('uses the selected range length when it is at least 30 minutes', () => {
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T10:00:00')

    expect(estimateMinutesForRange({ start, end })).toBe(60)
  })

  it('clamps a shorter selection (e.g. a plain click) up to 30 minutes', () => {
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T09:15:00')

    expect(estimateMinutesForRange({ start, end })).toBe(30)
  })
})
