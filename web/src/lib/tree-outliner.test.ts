import { describe, expect, it } from 'vitest'

import { makeNode } from '#components/task/task-row-test-fixtures'
import {
  buildAncestorChain,
  buildTreeRenderRows,
  flattenVisibleRows,
  resolveOutlinerTarget,
  type VisibleRow,
} from '#lib/tree-outliner'

const alwaysExpanded = () => true

describe('flattenVisibleRows', () => {
  it('flattens a single root with no children', () => {
    const tree = [makeNode({ id: 'a', number: 1 })]

    expect(flattenVisibleRows(tree, alwaysExpanded)).toEqual([
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

    expect(flattenVisibleRows(tree, alwaysExpanded)).toEqual([
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

    expect(flattenVisibleRows(tree, (id: string) => id !== 'b')).toEqual([
      { id: 'a', number: 1, parentId: null, depth: 0 },
      { id: 'b', number: 2, parentId: 'a', depth: 1 },
      { id: 'd', number: 4, parentId: null, depth: 0 },
    ])
  })
})

describe('buildTreeRenderRows', () => {
  it('flattens nested visible nodes with depth, no outliner input', () => {
    const c = makeNode({ id: 'c', number: 3 })
    const b = makeNode({ id: 'b', number: 2, children: [c] })
    const a = makeNode({ id: 'a', number: 1, children: [b] })

    expect(
      buildTreeRenderRows([a], {
        isExpanded: alwaysExpanded,
        outlinerInput: null,
      }),
    ).toEqual([
      { type: 'task', node: a, depth: 0 },
      { type: 'task', node: b, depth: 1 },
      { type: 'task', node: c, depth: 2 },
    ])
  })

  it("skips a collapsed node's subtree but keeps the node itself", () => {
    const c = makeNode({ id: 'c', number: 3 })
    const b = makeNode({ id: 'b', number: 2, children: [c] })
    const a = makeNode({ id: 'a', number: 1, children: [b] })
    const d = makeNode({ id: 'd', number: 4 })

    expect(
      buildTreeRenderRows([a, d], {
        isExpanded: (id) => id !== 'b',
        outlinerInput: null,
      }),
    ).toEqual([
      { type: 'task', node: a, depth: 0 },
      { type: 'task', node: b, depth: 1 },
      { type: 'task', node: d, depth: 0 },
    ])
  })

  it('inserts a child-mode input as the last child, after any real children', () => {
    const b = makeNode({ id: 'b', number: 2 })
    const a = makeNode({ id: 'a', number: 1, children: [b] })

    expect(
      buildTreeRenderRows([a], {
        isExpanded: alwaysExpanded,
        outlinerInput: { anchorRowId: 'a', mode: 'child' },
      }),
    ).toEqual([
      { type: 'task', node: a, depth: 0 },
      { type: 'task', node: b, depth: 1 },
      { type: 'outliner-input' },
    ])
  })

  it("forces a collapsed anchor's children into view for a child-mode input", () => {
    const b = makeNode({ id: 'b', number: 2 })
    const a = makeNode({ id: 'a', number: 1, children: [b] })

    expect(
      buildTreeRenderRows([a], {
        isExpanded: () => false,
        outlinerInput: { anchorRowId: 'a', mode: 'child' },
      }),
    ).toEqual([
      { type: 'task', node: a, depth: 0 },
      { type: 'task', node: b, depth: 1 },
      { type: 'outliner-input' },
    ])
  })

  it('shows a child-mode input alone under an otherwise childless node', () => {
    const leaf = makeNode({ id: 'leaf', number: 1 })

    expect(
      buildTreeRenderRows([leaf], {
        isExpanded: alwaysExpanded,
        outlinerInput: { anchorRowId: 'leaf', mode: 'child' },
      }),
    ).toEqual([
      { type: 'task', node: leaf, depth: 0 },
      { type: 'outliner-input' },
    ])
  })

  it("inserts a sibling-mode input after the anchor's entire subtree, before its next sibling", () => {
    const a1 = makeNode({ id: 'a1', number: 2 })
    const a = makeNode({ id: 'a', number: 1, children: [a1] })
    const b = makeNode({ id: 'b', number: 3 })

    expect(
      buildTreeRenderRows([a, b], {
        isExpanded: alwaysExpanded,
        outlinerInput: { anchorRowId: 'a', mode: 'sibling' },
      }),
    ).toEqual([
      { type: 'task', node: a, depth: 0 },
      { type: 'task', node: a1, depth: 1 },
      { type: 'outliner-input' },
      { type: 'task', node: b, depth: 0 },
    ])
  })

  it('inserts a sibling-mode input at the top level after a childless root anchor', () => {
    const a = makeNode({ id: 'a', number: 1 })
    const b = makeNode({ id: 'b', number: 2 })

    expect(
      buildTreeRenderRows([a, b], {
        isExpanded: alwaysExpanded,
        outlinerInput: { anchorRowId: 'a', mode: 'sibling' },
      }),
    ).toEqual([
      { type: 'task', node: a, depth: 0 },
      { type: 'outliner-input' },
      { type: 'task', node: b, depth: 0 },
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
