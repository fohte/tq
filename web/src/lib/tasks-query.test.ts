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
  it('builds a not-completed, tag-scoped, priority-sorted search', () => {
    expect(tagFilterSearch('dev:tq')).toEqual({
      q: 'is:todo label:dev:tq sort:priority',
    })
  })
})

describe('sortOptionValues', () => {
  it('exposes the dropdown/tab-strip sort choices', () => {
    expect(sortOptionValues).toEqual(['updated', 'due', 'created', 'priority'])
  })

  it('keeps the project default separate from the task-list priority default', () => {
    expect(getTaskSortDefaults()).toEqual({
      projectSort: 'updated',
      taskListSort: 'priority',
      taskListQuery: 'is:todo sort:priority',
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
