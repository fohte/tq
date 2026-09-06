import { describe, expect, it } from 'vitest'

import {
  type KanbanColumnTaskIds,
  resolveKanbanCandidateDrop,
  resolveKanbanCardDrop,
} from '#lib/task-kanban'

const columns: KanbanColumnTaskIds[] = [
  { id: 'inbox', taskIds: ['a', 'b'] },
  { id: 'active', taskIds: ['c'] },
]

describe('resolveKanbanCardDrop', () => {
  it('resolves a cross-column move when dropped on a different column', () => {
    expect(resolveKanbanCardDrop(columns, 'inbox', 'a', 'active')).toEqual({
      type: 'move',
      columnId: 'active',
    })
  })

  it('resolves a cross-column move when dropped on a card in a different column', () => {
    expect(resolveKanbanCardDrop(columns, 'inbox', 'a', 'c')).toEqual({
      type: 'move',
      columnId: 'active',
    })
  })

  it('resolves a same-column reorder when dropped on another card in the source column', () => {
    expect(resolveKanbanCardDrop(columns, 'inbox', 'a', 'b')).toEqual({
      type: 'reorder',
      columnId: 'inbox',
      taskIds: ['b', 'a'],
    })
  })

  it('returns null when dropped back onto itself', () => {
    expect(resolveKanbanCardDrop(columns, 'inbox', 'a', 'a')).toBeNull()
  })

  it('returns null when dropped on the empty area of its own column', () => {
    expect(resolveKanbanCardDrop(columns, 'inbox', 'a', 'inbox')).toBeNull()
  })

  it('returns null when dropped outside any column', () => {
    expect(resolveKanbanCardDrop(columns, 'inbox', 'a', null)).toBeNull()
  })
})

describe('resolveKanbanCandidateDrop', () => {
  it('inserts before the target card when dropped on its top half', () => {
    expect(resolveKanbanCandidateDrop(columns, 'b', false)).toEqual({
      columnId: 'inbox',
      index: 1,
    })
  })

  it('inserts after the target card when dropped on its bottom half', () => {
    expect(resolveKanbanCandidateDrop(columns, 'b', true)).toEqual({
      columnId: 'inbox',
      index: 2,
    })
  })

  it('appends to the end when dropped on the column itself', () => {
    expect(resolveKanbanCandidateDrop(columns, 'active', false)).toEqual({
      columnId: 'active',
      index: 1,
    })
  })

  it('returns null when dropped outside any column', () => {
    expect(resolveKanbanCandidateDrop(columns, null, false)).toBeNull()
  })
})
