import { describe, expect, it } from 'vitest'

import { resolveKanbanDrop } from '#lib/task-kanban'

describe('resolveKanbanDrop', () => {
  it('returns the target column when dropped on a different column', () => {
    expect(resolveKanbanDrop('inbox', 'active')).toBe('active')
  })

  it('returns null when dropped back onto its own column', () => {
    expect(resolveKanbanDrop('inbox', 'inbox')).toBeNull()
  })

  it('returns null when dropped outside any column', () => {
    expect(resolveKanbanDrop('inbox', null)).toBeNull()
  })
})
