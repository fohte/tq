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
})
