import { describe, expect, it } from 'vitest'

import {
  buildLabelTree,
  buildTagTreeFromCounts,
  flattenLabelTree,
} from '#lib/tag-tree'
import { makeTagCount } from '#lib/tag-tree-test-fixtures'

describe('buildTagTreeFromCounts', () => {
  it('uses server counts, adds zero-count labels, and sorts each level', () => {
    expect(
      buildTagTreeFromCounts(
        [
          makeTagCount({ name: 'team', count: 3 }),
          makeTagCount({ name: 'team/api', count: 2 }),
          makeTagCount({ name: 'team/ui', count: 2 }),
          makeTagCount({ name: 'alpha', count: 1 }),
          makeTagCount({ name: 'zeta', count: 1 }),
          makeTagCount({ name: 'completed-only' }),
        ],
        ['orphan', 'unused/group'],
      ),
    ).toEqual([
      {
        name: 'team',
        count: 3,
        children: [
          { name: 'team/api', count: 2, children: [] },
          { name: 'team/ui', count: 2, children: [] },
        ],
      },
      { name: 'alpha', count: 1, children: [] },
      { name: 'zeta', count: 1, children: [] },
      { name: 'completed-only', count: 0, children: [] },
      { name: 'orphan', count: 0, children: [] },
      {
        name: 'unused',
        count: 0,
        children: [{ name: 'unused/group', count: 0, children: [] }],
      },
    ])
  })
})

describe('buildLabelTree', () => {
  it('keeps a flat name as a childless root', () => {
    expect(buildLabelTree(['urgent'])).toEqual([
      { name: 'urgent', children: [] },
    ])
  })

  it('synthesizes an intermediate parent absent from the name list', () => {
    expect(buildLabelTree(['dev/tq'])).toEqual([
      {
        name: 'dev',
        children: [{ name: 'dev/tq', children: [] }],
      },
    ])
  })

  it('groups multiple children under the same synthesized parent, sorted by name', () => {
    expect(buildLabelTree(['dev/tq', 'dev/infra'])).toEqual([
      {
        name: 'dev',
        children: [
          { name: 'dev/infra', children: [] },
          { name: 'dev/tq', children: [] },
        ],
      },
    ])
  })

  it('merges a name that is also an ancestor of another name into one node', () => {
    expect(buildLabelTree(['dev', 'dev/tq'])).toEqual([
      {
        name: 'dev',
        children: [{ name: 'dev/tq', children: [] }],
      },
    ])
  })

  it('sorts roots by name ascending', () => {
    expect(buildLabelTree(['b', 'a', 'c'])).toEqual([
      { name: 'a', children: [] },
      { name: 'b', children: [] },
      { name: 'c', children: [] },
    ])
  })

  it('nests beyond one level', () => {
    expect(buildLabelTree(['a/b/c'])).toEqual([
      {
        name: 'a',
        children: [
          {
            name: 'a/b',
            children: [{ name: 'a/b/c', children: [] }],
          },
        ],
      },
    ])
  })

  it('returns an empty array for no names', () => {
    expect(buildLabelTree([])).toEqual([])
  })
})

describe('flattenLabelTree', () => {
  it('flattens nested nodes in pre-order', () => {
    expect(
      flattenLabelTree([
        { name: 'chore', children: [] },
        {
          name: 'dev',
          children: [
            { name: 'dev/infra', children: [] },
            { name: 'dev/tq', children: [] },
          ],
        },
      ]),
    ).toEqual(['chore', 'dev', 'dev/infra', 'dev/tq'])
  })

  it('returns an empty array for no nodes', () => {
    expect(flattenLabelTree([])).toEqual([])
  })
})
