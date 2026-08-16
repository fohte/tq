import type { ParsedQuery } from 'api/search-query-parser'
import { describe, expect, it } from 'vitest'

import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  toggleSearchFilter,
} from '#hooks/use-search'

describe('toggleSearchFilter', () => {
  it('adds a status when none is selected', () => {
    const parsed: ParsedQuery = { freeText: 'armyknife' }
    expect(toggleSearchFilter(parsed, 'status', 'todo')).toEqual({
      freeText: 'armyknife',
      status: ['todo'],
    })
  })

  it('accumulates multiple statuses instead of replacing', () => {
    const parsed: ParsedQuery = { freeText: '', status: ['todo'] }
    expect(toggleSearchFilter(parsed, 'status', 'in_progress')).toEqual({
      freeText: '',
      status: ['todo', 'in_progress'],
    })
  })

  it('removes a status that is already selected', () => {
    const parsed: ParsedQuery = {
      freeText: '',
      status: ['todo', 'in_progress'],
    }
    expect(toggleSearchFilter(parsed, 'status', 'todo')).toEqual({
      freeText: '',
      status: ['in_progress'],
    })
  })

  it('clears status entirely once the last value is removed', () => {
    const parsed: ParsedQuery = { freeText: '', status: ['todo'] }
    expect(toggleSearchFilter(parsed, 'status', 'todo')).toEqual({
      freeText: '',
      status: undefined,
    })
  })

  it('replaces context when a different value is toggled', () => {
    const parsed: ParsedQuery = { freeText: '', context: 'work' }
    expect(toggleSearchFilter(parsed, 'context', 'personal')).toEqual({
      freeText: '',
      context: 'personal',
    })
  })

  it('clears context when the active value is toggled again', () => {
    const parsed: ParsedQuery = { freeText: '', context: 'work' }
    expect(toggleSearchFilter(parsed, 'context', 'work')).toEqual({
      freeText: '',
      context: undefined,
    })
  })

  it('sets sortBy when none is selected', () => {
    const parsed: ParsedQuery = { freeText: '' }
    expect(toggleSearchFilter(parsed, 'sortBy', 'due')).toEqual({
      freeText: '',
      sortBy: 'due',
    })
  })

  it('replaces sortBy when a different value is toggled', () => {
    const parsed: ParsedQuery = { freeText: '', sortBy: 'due' }
    expect(toggleSearchFilter(parsed, 'sortBy', 'created')).toEqual({
      freeText: '',
      sortBy: 'created',
    })
  })

  it('clears sortBy when the active value is toggled again', () => {
    const parsed: ParsedQuery = { freeText: '', sortBy: 'due' }
    expect(toggleSearchFilter(parsed, 'sortBy', 'due')).toEqual({
      freeText: '',
      sortBy: undefined,
    })
  })
})

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
