import { describe, expect, it } from 'vitest'

import { applySuggestionToQuery, extractCurrentPrefix } from '#hooks/use-search'

describe('extractCurrentPrefix', () => {
  it('returns the whole query when it is a single bare word', () => {
    expect(extractCurrentPrefix('is')).toBe('is')
  })

  it('returns the last word being typed', () => {
    expect(extractCurrentPrefix('context:work is')).toBe('is')
  })

  it('returns the token when it ends with a colon', () => {
    expect(extractCurrentPrefix('is:')).toBe('is:')
  })

  it('returns empty once the token is a complete key:value pair', () => {
    expect(extractCurrentPrefix('is:todo')).toBe('')
  })

  it('returns empty for an empty query', () => {
    expect(extractCurrentPrefix('')).toBe('')
  })
})

describe('applySuggestionToQuery', () => {
  it('replaces the last word being typed with the suggestion value', () => {
    expect(
      applySuggestionToQuery('sort:updated is', {
        value: 'is:todo',
        display: 'Todo',
        category: 'is',
      }),
    ).toBe('sort:updated is:todo ')
  })

  it('replaces the sole token when the query is a single bare word', () => {
    expect(
      applySuggestionToQuery('is', {
        value: 'is:todo',
        display: 'Todo',
        category: 'is',
      }),
    ).toBe('is:todo ')
  })
})
