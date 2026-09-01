import { describe, expect, it } from 'vitest'

import { makeNode, makeTask } from '#components/task/task-row-test-fixtures'
import { buildTree, mergeLazyChildren } from '#lib/tree-builder'

describe('buildTree', () => {
  it('returns an empty array for an empty list', () => {
    expect(buildTree([])).toEqual([])
  })

  it('nests children under their parent', () => {
    const root = makeTask({ id: 'root', parentId: null })
    const child = makeTask({ id: 'child', parentId: 'root' })
    const grandchild = makeTask({ id: 'grandchild', parentId: 'child' })

    expect(buildTree([root, child, grandchild])).toEqual([
      {
        ...root,
        children: [{ ...child, children: [{ ...grandchild, children: [] }] }],
      },
    ])
  })

  it('keeps unrelated tasks as separate roots', () => {
    const a = makeTask({ id: 'a', parentId: null })
    const b = makeTask({ id: 'b', parentId: null })

    expect(buildTree([a, b])).toEqual([
      { ...a, children: [] },
      { ...b, children: [] },
    ])
  })

  it('treats a task whose parent is missing from the list as a root', () => {
    const orphan = makeTask({ id: 'orphan', parentId: 'missing-parent' })

    expect(buildTree([orphan])).toEqual([{ ...orphan, children: [] }])
  })
})

describe('mergeLazyChildren', () => {
  it('leaves a root with no fetched children as children: []', () => {
    const root = makeNode({ id: 'a', number: 1 })

    expect(mergeLazyChildren([root], new Map())).toEqual([
      { ...root, children: [] },
    ])
  })

  it('attaches fetched children for a root as fresh TreeNodes', () => {
    const root = makeNode({ id: 'a', number: 1 })
    const fetchedChild = makeTask({ id: 'b', number: 2, parentId: 'a' })

    expect(mergeLazyChildren([root], new Map([['a', [fetchedChild]]]))).toEqual(
      [
        {
          ...root,
          children: [{ ...fetchedChild, children: [] }],
        },
      ],
    )
  })

  it('merges fetched grandchildren into an already-fetched child', () => {
    const root = makeNode({ id: 'a', number: 1 })
    const fetchedChild = makeTask({ id: 'b', number: 2, parentId: 'a' })
    const fetchedGrandchild = makeTask({ id: 'c', number: 3, parentId: 'b' })

    expect(
      mergeLazyChildren(
        [root],
        new Map([
          ['a', [fetchedChild]],
          ['b', [fetchedGrandchild]],
        ]),
      ),
    ).toEqual([
      {
        ...root,
        children: [
          {
            ...fetchedChild,
            children: [{ ...fetchedGrandchild, children: [] }],
          },
        ],
      },
    ])
  })
})
