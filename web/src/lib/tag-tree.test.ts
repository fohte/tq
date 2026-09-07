import { describe, expect, it } from 'vitest'

import { buildTagTree } from '#lib/tag-tree'

describe('buildTagTree', () => {
  it('keeps a flat tag name as a childless root', () => {
    expect(buildTagTree([{ name: 'urgent', count: 2 }])).toEqual([
      { name: 'urgent', count: 2, children: [] },
    ])
  })

  it('synthesizes an intermediate parent absent from the input', () => {
    expect(buildTagTree([{ name: 'dev/tq', count: 3 }])).toEqual([
      {
        name: 'dev',
        count: 3,
        children: [{ name: 'dev/tq', count: 3, children: [] }],
      },
    ])
  })

  it('rolls up a real parent count with its children', () => {
    expect(
      buildTagTree([
        { name: 'dev', count: 1 },
        { name: 'dev/tq', count: 3 },
      ]),
    ).toEqual([
      {
        name: 'dev',
        count: 4,
        children: [{ name: 'dev/tq', count: 3, children: [] }],
      },
    ])
  })

  it('groups multiple children under the same synthesized parent, count desc then name asc', () => {
    expect(
      buildTagTree([
        { name: 'dev/tq', count: 1 },
        { name: 'dev/infra', count: 5 },
      ]),
    ).toEqual([
      {
        name: 'dev',
        count: 6,
        children: [
          { name: 'dev/infra', count: 5, children: [] },
          { name: 'dev/tq', count: 1, children: [] },
        ],
      },
    ])
  })

  it('sorts roots by count descending, then name ascending', () => {
    expect(
      buildTagTree([
        { name: 'b', count: 1 },
        { name: 'a', count: 1 },
        { name: 'c', count: 5 },
      ]),
    ).toEqual([
      { name: 'c', count: 5, children: [] },
      { name: 'a', count: 1, children: [] },
      { name: 'b', count: 1, children: [] },
    ])
  })

  it('nests beyond one level', () => {
    expect(buildTagTree([{ name: 'a/b/c', count: 2 }])).toEqual([
      {
        name: 'a',
        count: 2,
        children: [
          {
            name: 'a/b',
            count: 2,
            children: [{ name: 'a/b/c', count: 2, children: [] }],
          },
        ],
      },
    ])
  })

  it('returns an empty array for no tag counts', () => {
    expect(buildTagTree([])).toEqual([])
  })
})
