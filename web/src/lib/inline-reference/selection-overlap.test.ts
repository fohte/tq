import { describe, expect, it } from 'vitest'

import { rangeTouchesSelection } from '#lib/inline-reference/selection-overlap'

describe('rangeTouchesSelection', () => {
  it('is false when the collapsed cursor sits strictly outside the range', () => {
    expect(rangeTouchesSelection(0, 0, 5, 10)).toBe(false)
    expect(rangeTouchesSelection(20, 20, 5, 10)).toBe(false)
  })

  it('is true when the collapsed cursor sits inside the range', () => {
    expect(rangeTouchesSelection(7, 7, 5, 10)).toBe(true)
  })

  it('is true when the collapsed cursor sits exactly on either boundary', () => {
    expect(rangeTouchesSelection(5, 5, 5, 10)).toBe(true)
    expect(rangeTouchesSelection(10, 10, 5, 10)).toBe(true)
  })

  it('is true when a non-collapsed selection overlaps the range', () => {
    expect(rangeTouchesSelection(0, 6, 5, 10)).toBe(true)
    expect(rangeTouchesSelection(9, 20, 5, 10)).toBe(true)
  })

  it('is false when a non-collapsed selection sits entirely outside the range', () => {
    expect(rangeTouchesSelection(0, 4, 5, 10)).toBe(false)
    expect(rangeTouchesSelection(11, 20, 5, 10)).toBe(false)
  })
})
