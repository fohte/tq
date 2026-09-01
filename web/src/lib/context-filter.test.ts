import { describe, expect, it } from 'vitest'

import { matchesContextFilter } from '#lib/context-filter'

describe('matchesContextFilter', () => {
  it('matches when the contexts are equal', () => {
    expect(matchesContextFilter('work', 'work')).toBe(true)
    expect(matchesContextFilter('personal', 'personal')).toBe(true)
  })

  it('does not match when the contexts differ', () => {
    expect(matchesContextFilter('personal', 'work')).toBe(false)
    expect(matchesContextFilter('work', 'personal')).toBe(false)
  })
})
