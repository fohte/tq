import { describe, expect, it } from 'vitest'

import { greet } from '#index'

describe('greet', () => {
  it('returns a greeting for a name', () => {
    expect(greet('World')).toBe('Hello, World!')
  })

  it('returns a greeting when the name is empty', () => {
    expect(greet('')).toBe('Hello, !')
  })
})
