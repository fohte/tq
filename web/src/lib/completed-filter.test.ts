import { describe, expect, it } from 'vitest'

import { filterByCompleted, filterTreeByCompleted } from '#lib/completed-filter'

describe('filterByCompleted', () => {
  it('returns the items unchanged when showCompleted is true', () => {
    const items = [{ status: 'completed' }, { status: 'todo' }]
    expect(filterByCompleted(items, true)).toBe(items)
  })

  it('drops completed items when showCompleted is false', () => {
    const a = { id: 'a', status: 'todo' }
    const b = { id: 'b', status: 'completed' }
    const c = { id: 'c', status: 'in_progress' }
    expect(filterByCompleted([a, b, c], false)).toEqual([a, c])
  })
})

interface TreeNode {
  id: string
  status: string
  children: TreeNode[]
}

describe('filterTreeByCompleted', () => {
  it('returns the nodes unchanged when showCompleted is true', () => {
    const nodes: TreeNode[] = [{ id: 'a', status: 'completed', children: [] }]
    expect(filterTreeByCompleted(nodes, true)).toBe(nodes)
  })

  it('drops completed nodes with no non-completed descendants', () => {
    const nodes: TreeNode[] = [
      { id: 'a', status: 'todo', children: [] },
      { id: 'b', status: 'completed', children: [] },
    ]
    expect(filterTreeByCompleted(nodes, false)).toEqual([
      { id: 'a', status: 'todo', children: [] },
    ])
  })

  it('keeps a completed ancestor whose descendant is not completed, pruning completed siblings', () => {
    const nodes: TreeNode[] = [
      {
        id: 'parent',
        status: 'completed',
        children: [
          { id: 'child-open', status: 'todo', children: [] },
          { id: 'child-done', status: 'completed', children: [] },
        ],
      },
    ]
    expect(filterTreeByCompleted(nodes, false)).toEqual([
      {
        id: 'parent',
        status: 'completed',
        children: [{ id: 'child-open', status: 'todo', children: [] }],
      },
    ])
  })
})
