import { parseSearchQuery } from 'api/search-query-parser'
import { describe, expect, it } from 'vitest'

import {
  sortOptionValues,
  tagFilterSearch,
  withDefaultSort,
} from '#lib/tasks-query'

describe('tagFilterSearch', () => {
  it('builds a not-completed, tag-scoped, updated-sorted search', () => {
    expect(tagFilterSearch('dev:tq')).toEqual({
      q: 'is:todo label:dev:tq sort:updated',
    })
  })
})

describe('sortOptionValues', () => {
  it('exposes the dropdown/tab-strip sort choices', () => {
    expect(sortOptionValues).toEqual(['updated', 'due', 'created'])
  })
})

describe('withDefaultSort', () => {
  it('defaults the sort when the query has none', () => {
    expect(withDefaultSort({ freeText: '' })).toEqual({
      freeText: '',
      sortBy: 'updated',
    })
  })

  it('defaults the sort when a stored query uses an unsupported sort', () => {
    expect(withDefaultSort(parseSearchQuery('sort:invalid'))).toEqual({
      freeText: '',
      sortBy: 'updated',
    })
  })
})
