import { describe, expect, it } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { getDescendantIds } from '#lib/task-tree'

describe('getDescendantIds', () => {
  it('returns an empty array when the task has no children', () => {
    const tasks = [makeTask({ id: 'a' })]

    expect(getDescendantIds(tasks, 'a')).toEqual([])
  })

  it('returns direct children', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', parentId: 'a' }),
      makeTask({ id: 'c', parentId: 'a' }),
    ]

    expect(getDescendantIds(tasks, 'a')).toEqual(['b', 'c'])
  })

  it('returns multi-level descendants', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', parentId: 'a' }),
      makeTask({ id: 'c', parentId: 'b' }),
      makeTask({ id: 'd', parentId: 'c' }),
    ]

    expect(getDescendantIds(tasks, 'a')).toEqual(['b', 'c', 'd'])
  })

  it('returns an empty array for a task with no relation to any other task', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', parentId: 'a' }),
      makeTask({ id: 'unrelated' }),
    ]

    expect(getDescendantIds(tasks, 'unrelated')).toEqual([])
  })
})
