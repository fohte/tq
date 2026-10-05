import { describe, expect, it } from 'vitest'

import { getNowPanelQueryDateRange } from '#lib/compact-layout'

describe('getNowPanelQueryDateRange', () => {
  it('covers today and the Now panel lookahead window', () => {
    expect(getNowPanelQueryDateRange(new Date(2031, 3, 9, 23, 30))).toEqual({
      startDate: '2031-04-09',
      endDate: '2031-05-09',
    })
  })
})
