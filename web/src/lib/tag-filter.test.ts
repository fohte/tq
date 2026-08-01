import { describe, expect, it } from 'vitest'

import {
  computeTagCounts,
  filterByTag,
  filterTreeByTag,
  matchesTagFilter,
} from '#lib/tag-filter'

describe('matchesTagFilter', () => {
  it('matches everything when tag is null', () => {
    expect(matchesTagFilter(['work'], null)).toBe(true)
  })

  it('matches when the task has the tag', () => {
    expect(matchesTagFilter(['work', 'urgent'], 'urgent')).toBe(true)
  })

  it('does not match when the task lacks the tag', () => {
    expect(matchesTagFilter(['work'], 'urgent')).toBe(false)
  })
})

describe('filterByTag', () => {
  it('returns the items unchanged when tag is null', () => {
    const items = [{ labels: ['a'] }, { labels: [] }]
    expect(filterByTag(items, null)).toBe(items)
  })

  it('keeps only items whose labels include the tag', () => {
    const a = { id: 'a', labels: ['urgent'] }
    const b = { id: 'b', labels: ['work'] }
    const c = { id: 'c', labels: ['urgent', 'work'] }
    expect(filterByTag([a, b, c], 'urgent')).toEqual([a, c])
  })
})

interface TreeNode {
  id: string
  labels: string[]
  children: TreeNode[]
}

describe('filterTreeByTag', () => {
  it('returns the nodes unchanged when tag is null', () => {
    const nodes: TreeNode[] = [{ id: 'a', labels: [], children: [] }]
    expect(filterTreeByTag(nodes, null)).toBe(nodes)
  })

  it('drops nodes that neither match nor have a matching descendant', () => {
    const nodes: TreeNode[] = [
      { id: 'a', labels: ['urgent'], children: [] },
      { id: 'b', labels: ['work'], children: [] },
    ]
    expect(filterTreeByTag(nodes, 'urgent')).toEqual([
      { id: 'a', labels: ['urgent'], children: [] },
    ])
  })

  it('keeps an ancestor whose descendant matches, pruning non-matching siblings', () => {
    const nodes: TreeNode[] = [
      {
        id: 'parent',
        labels: ['work'],
        children: [
          { id: 'child-match', labels: ['urgent'], children: [] },
          { id: 'child-no-match', labels: ['work'], children: [] },
        ],
      },
    ]
    expect(filterTreeByTag(nodes, 'urgent')).toEqual([
      {
        id: 'parent',
        labels: ['work'],
        children: [{ id: 'child-match', labels: ['urgent'], children: [] }],
      },
    ])
  })
})

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
