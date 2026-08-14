import { describe, expect, it } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { computeDropMode, getDescendantIds } from '#lib/task-tree'

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

describe('computeDropMode', () => {
  const overRect = { top: 100, height: 40 }

  it('returns "child" when there is no active rect', () => {
    expect(computeDropMode(overRect, null)).toBe('child')
  })

  it('returns "child" when the dragged item center is in the middle band', () => {
    const activeRect = { top: 115, height: 10 } // center at 120, 50% through overRect

    expect(computeDropMode(overRect, activeRect)).toBe('child')
  })

  it('returns "sibling" when the dragged item center is in the top band', () => {
    const activeRect = { top: 100, height: 4 } // center at 102, 5% through overRect

    expect(computeDropMode(overRect, activeRect)).toBe('sibling')
  })

  it('returns "sibling" when the dragged item center is in the bottom band', () => {
    const activeRect = { top: 134, height: 4 } // center at 136, 90% through overRect

    expect(computeDropMode(overRect, activeRect)).toBe('sibling')
  })
})
