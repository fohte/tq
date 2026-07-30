import { describe, expect, it } from 'vitest'

import { rangeTouchesSelection } from '#lib/inline-reference/selection-overlap'

describe('rangeTouchesSelection', () => {
  it('is false when the collapsed cursor sits strictly before the range', () => {
    expect(rangeTouchesSelection(0, 0, 5, 10)).toBe(false)
  })

  it('is false when the collapsed cursor sits strictly after the range', () => {
    expect(rangeTouchesSelection(20, 20, 5, 10)).toBe(false)
  })

  it('is true when the collapsed cursor sits inside the range', () => {
    expect(rangeTouchesSelection(7, 7, 5, 10)).toBe(true)
  })

  it('is true when the collapsed cursor sits exactly on the start boundary', () => {
    expect(rangeTouchesSelection(5, 5, 5, 10)).toBe(true)
  })

  it('is true when the collapsed cursor sits exactly on the end boundary', () => {
    expect(rangeTouchesSelection(10, 10, 5, 10)).toBe(true)
  })

  it('is true when a non-collapsed selection overlaps the start of the range', () => {
    expect(rangeTouchesSelection(0, 6, 5, 10)).toBe(true)
  })

  it('is true when a non-collapsed selection overlaps the end of the range', () => {
    expect(rangeTouchesSelection(9, 20, 5, 10)).toBe(true)
  })

  it('is false when a non-collapsed selection sits entirely before the range', () => {
    expect(rangeTouchesSelection(0, 4, 5, 10)).toBe(false)
  })

  it('is false when a non-collapsed selection sits entirely after the range', () => {
    expect(rangeTouchesSelection(11, 20, 5, 10)).toBe(false)
  })
})
