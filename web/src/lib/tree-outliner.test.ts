import { describe, expect, it } from 'vitest'

import { makeNode } from '#components/task/task-row-test-fixtures'
import {
  buildAncestorChain,
  flattenVisibleRows,
  resolveOutlinerTarget,
  type VisibleRow,
} from '#lib/tree-outliner'

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

describe('resolveOutlinerTarget', () => {
  const rows: VisibleRow[] = [
    { id: 'a', number: 1, parentId: null, depth: 0 },
    { id: 'b', number: 2, parentId: 'a', depth: 1 },
  ]

  it('returns null when the anchor row is not visible', () => {
    expect(
      resolveOutlinerTarget(rows, { anchorRowId: 'missing', mode: 'child' }),
    ).toBeNull()
  })

  it('resolves child mode to a parent of the anchor itself, one level deeper', () => {
    expect(
      resolveOutlinerTarget(rows, { anchorRowId: 'b', mode: 'child' }),
    ).toEqual({ parentId: 'b', parentNumber: 2, depth: 2 })
  })

  it("resolves sibling mode to the anchor's own parent, at the same depth", () => {
    expect(
      resolveOutlinerTarget(rows, { anchorRowId: 'b', mode: 'sibling' }),
    ).toEqual({ parentId: 'a', parentNumber: 1, depth: 1 })
  })

  it('resolves sibling mode on a root row to a top-level (null) parent', () => {
    expect(
      resolveOutlinerTarget(rows, { anchorRowId: 'a', mode: 'sibling' }),
    ).toEqual({ parentId: null, parentNumber: null, depth: 0 })
  })
})

describe('buildAncestorChain', () => {
  const rows: VisibleRow[] = [
    { id: 'a', number: 1, parentId: null, depth: 0 },
    { id: 'b', number: 2, parentId: 'a', depth: 1 },
    { id: 'c', number: 3, parentId: 'b', depth: 2 },
  ]

  it('returns an empty chain for a null (top-level) parent', () => {
    expect(buildAncestorChain(rows, null)).toEqual([])
  })

  it('returns a single-entry chain (itself) for a root parent', () => {
    expect(buildAncestorChain(rows, 'a')).toEqual([{ id: 'a', number: 1 }])
  })

  it('returns the full chain root-first, including the parent itself', () => {
    expect(buildAncestorChain(rows, 'c')).toEqual([
      { id: 'a', number: 1 },
      { id: 'b', number: 2 },
      { id: 'c', number: 3 },
    ])
  })
})
