import { describe, expect, it } from 'vitest'

import { computeTagCounts } from '#lib/tag-counts'

interface TaskLike {
  status: string
  labels: string[]
}

function makeTask(overrides: Partial<TaskLike> = {}): TaskLike {
  return { status: 'todo', labels: [], ...overrides }
}

describe('computeTagCounts', () => {
  it('counts each label once per non-completed task, sorted by count desc then name asc', () => {
    const tasks = [
      makeTask({ labels: ['work', 'urgent'] }),
      makeTask({ labels: ['work'] }),
      makeTask({ labels: ['urgent'], status: 'completed' }),
    ]
    expect(computeTagCounts(tasks)).toEqual([
      { name: 'work', count: 2 },
      { name: 'urgent', count: 1 },
    ])
  })

  it('breaks ties by tag name ascending', () => {
    const tasks = [makeTask({ labels: ['b'] }), makeTask({ labels: ['a'] })]
    expect(computeTagCounts(tasks)).toEqual([
      { name: 'a', count: 1 },
      { name: 'b', count: 1 },
    ])
  })

  it('lists a label with count 0 when only completed tasks carry it', () => {
    const tasks = [makeTask({ labels: ['done-only'], status: 'completed' })]
    expect(computeTagCounts(tasks)).toEqual([{ name: 'done-only', count: 0 }])
  })

  it('returns an empty array for no tasks', () => {
    expect(computeTagCounts([])).toEqual([])
  })
})
