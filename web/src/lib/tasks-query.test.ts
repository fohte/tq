import { parseSearchQuery } from 'api/search-query-parser'
import { describe, expect, it } from 'vitest'

import {
  defaultTaskListSort,
  defaultTaskSort,
  sortOptionValues,
  tagFilterSearch,
  taskListSearchDefaultQuery,
  withDefaultSort,
} from '#lib/tasks-query'

function getTaskSortDefaults() {
  return {
    projectSort: defaultTaskSort,
    taskListSort: defaultTaskListSort,
    taskListQuery: taskListSearchDefaultQuery,
  }
}

describe('tagFilterSearch', () => {
  it('builds a not-completed, tag-scoped, priority-updated-sorted search', () => {
    expect(tagFilterSearch('dev:tq')).toEqual({
      q: 'is:todo label:dev:tq sort:priority-updated',
    })
  })
})

describe('sortOptionValues', () => {
  it('exposes the dropdown/tab-strip sort choices', () => {
    expect(sortOptionValues).toEqual([
      'updated',
      'due',
      'created',
      'priority',
      'priority-updated',
    ])
  })

  it('keeps the project default separate from the task-list priority-updated default', () => {
    expect(getTaskSortDefaults()).toEqual({
      projectSort: 'updated',
      taskListSort: 'priority-updated',
      taskListQuery: 'is:todo sort:priority-updated',
    })
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
