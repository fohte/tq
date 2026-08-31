import { describe, expect, it } from 'vitest'

import { makeNode } from '#components/task/task-row-test-fixtures'
import { buildTreeRenderRows, flattenVisibleRows } from '#lib/tree-outliner'

const alwaysExpanded = () => true

describe('flattenVisibleRows', () => {
  it('flattens a single root with no children', () => {
    const tree = [makeNode({ id: 'a', number: 1 })]

    expect(flattenVisibleRows(tree, new Set())).toEqual([
      { id: 'a', number: 1, parentId: null, depth: 0 },
    ])
  })

  it('flattens nested children in pre-order with incrementing depth', () => {
    const tree = [
      makeNode({
        id: 'a',
        number: 1,
        children: [
          makeNode({
            id: 'b',
            number: 2,
            parentId: 'a',
            children: [makeNode({ id: 'c', number: 3, parentId: 'b' })],
          }),
        ],
      }),
    ]

    expect(flattenVisibleRows(tree, new Set())).toEqual([
      { id: 'a', number: 1, parentId: null, depth: 0 },
      { id: 'b', number: 2, parentId: 'a', depth: 1 },
      { id: 'c', number: 3, parentId: 'b', depth: 2 },
    ])
  })

  it('skips the subtree of a collapsed node but keeps the node itself', () => {
    const tree = [
      makeNode({
        id: 'a',
        number: 1,
        children: [
          makeNode({
            id: 'b',
            number: 2,
            parentId: 'a',
            children: [makeNode({ id: 'c', number: 3, parentId: 'b' })],
          }),
        ],
      }),
      makeNode({ id: 'd', number: 4 }),
    ]

    expect(flattenVisibleRows(tree, new Set(['b']))).toEqual([
      { id: 'a', number: 1, parentId: null, depth: 0 },
      { id: 'b', number: 2, parentId: 'a', depth: 1 },
      { id: 'd', number: 4, parentId: null, depth: 0 },
    ])
  })
})

describe('buildTreeRenderRows', () => {
  it('flattens nested visible nodes with depth', () => {
    const c = makeNode({ id: 'c', number: 3 })
    const b = makeNode({ id: 'b', number: 2, children: [c] })
    const a = makeNode({ id: 'a', number: 1, children: [b] })

    expect(buildTreeRenderRows([a], { isExpanded: alwaysExpanded })).toEqual([
      { node: a, depth: 0 },
      { node: b, depth: 1 },
      { node: c, depth: 2 },
    ])
  })

  it("skips a collapsed node's subtree but keeps the node itself", () => {
    const c = makeNode({ id: 'c', number: 3 })
    const b = makeNode({ id: 'b', number: 2, children: [c] })
    const a = makeNode({ id: 'a', number: 1, children: [b] })
    const d = makeNode({ id: 'd', number: 4 })

    expect(
      buildTreeRenderRows([a, d], { isExpanded: (id) => id !== 'b' }),
    ).toEqual([
      { node: a, depth: 0 },
      { node: b, depth: 1 },
      { node: d, depth: 0 },
    ])
  })
})
