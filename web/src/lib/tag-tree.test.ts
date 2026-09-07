import { describe, expect, it } from 'vitest'

import { buildTagTree } from '#lib/tag-tree'

interface TaskLike {
  status: string
  labels: string[]
}

function makeTask(overrides: Partial<TaskLike> = {}): TaskLike {
  return { status: 'todo', labels: [], ...overrides }
}

describe('buildTagTree', () => {
  it('keeps a flat tag name as a childless root', () => {
    expect(
      buildTagTree([
        makeTask({ labels: ['urgent'] }),
        makeTask({ labels: ['urgent'] }),
      ]),
    ).toEqual([{ name: 'urgent', count: 2, children: [] }])
  })

  it('synthesizes an intermediate parent absent from any task', () => {
    expect(buildTagTree([makeTask({ labels: ['dev/tq'] })])).toEqual([
      {
        name: 'dev',
        count: 1,
        children: [{ name: 'dev/tq', count: 1, children: [] }],
      },
    ])
  })

  it('rolls up a real parent count with its children', () => {
    expect(
      buildTagTree([
        makeTask({ labels: ['dev'] }),
        makeTask({ labels: ['dev/tq'] }),
      ]),
    ).toEqual([
      {
        name: 'dev',
        count: 2,
        children: [{ name: 'dev/tq', count: 1, children: [] }],
      },
    ])
  })

  it('counts a task tagged with both a parent and its child only once toward the parent', () => {
    expect(buildTagTree([makeTask({ labels: ['dev', 'dev/tq'] })])).toEqual([
      {
        name: 'dev',
        count: 1,
        children: [{ name: 'dev/tq', count: 1, children: [] }],
      },
    ])
  })

  it('groups multiple children under the same synthesized parent, count desc then name asc', () => {
    expect(
      buildTagTree([
        makeTask({ labels: ['dev/tq'] }),
        makeTask({ labels: ['dev/infra'] }),
        makeTask({ labels: ['dev/infra'] }),
      ]),
    ).toEqual([
      {
        name: 'dev',
        count: 3,
        children: [
          { name: 'dev/infra', count: 2, children: [] },
          { name: 'dev/tq', count: 1, children: [] },
        ],
      },
    ])
  })

  it('sorts roots by count descending, then name ascending', () => {
    expect(
      buildTagTree([
        makeTask({ labels: ['b'] }),
        makeTask({ labels: ['a'] }),
        makeTask({ labels: ['c'] }),
        makeTask({ labels: ['c'] }),
      ]),
    ).toEqual([
      { name: 'c', count: 2, children: [] },
      { name: 'a', count: 1, children: [] },
      { name: 'b', count: 1, children: [] },
    ])
  })

  it('nests beyond one level', () => {
    expect(buildTagTree([makeTask({ labels: ['a/b/c'] })])).toEqual([
      {
        name: 'a',
        count: 1,
        children: [
          {
            name: 'a/b',
            count: 1,
            children: [{ name: 'a/b/c', count: 1, children: [] }],
          },
        ],
      },
    ])
  })

  it('excludes a completed task from the count but still lists its label and any synthesized parent', () => {
    expect(
      buildTagTree([makeTask({ labels: ['dev/tq'], status: 'completed' })]),
    ).toEqual([
      {
        name: 'dev',
        count: 0,
        children: [{ name: 'dev/tq', count: 0, children: [] }],
      },
    ])
  })

  it('returns an empty array for no tasks', () => {
    expect(buildTagTree([])).toEqual([])
  })
})
