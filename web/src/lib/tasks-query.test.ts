import { describe, expect, it } from 'vitest'

import { sortOptionValues, tagFilterSearch } from '#lib/tasks-query'

describe('tagFilterSearch', () => {
  it('builds a not-completed, tag-scoped, updated-sorted search', () => {
    expect(tagFilterSearch('dev:tq')).toEqual({
      q: 'is:todo is:in_progress label:dev:tq sort:updated',
    })
  })
})

describe('sortOptionValues', () => {
  it('exposes the dropdown/tab-strip sort choices', () => {
    expect(sortOptionValues).toEqual(['updated', 'due', 'estimate', 'created'])
  })
})
