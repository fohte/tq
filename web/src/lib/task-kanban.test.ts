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
  it('resolves the target column when dropped on a card', () => {
    expect(resolveKanbanCandidateDrop(columns, 'b')).toEqual({
      columnId: 'inbox',
    })
  })

  it('resolves the target column when dropped on a column', () => {
    expect(resolveKanbanCandidateDrop(columns, 'active')).toEqual({
      columnId: 'active',
    })
  })

  it('returns null when dropped outside any column', () => {
    expect(resolveKanbanCandidateDrop(columns, null)).toBeNull()
  })
})
