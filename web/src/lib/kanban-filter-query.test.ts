import { describe, expect, it } from 'vitest'

import {
  buildKanbanFilterQuery,
  parseKanbanFilterQuery,
} from '#lib/kanban-filter-query'

describe('kanban filter query', () => {
  it('removes status and sort while keeping supported filters and free text', () => {
    expect(
      buildKanbanFilterQuery(
        'find this is:completed project:project-example label:sample-label has:pages parent:task-example sort:due',
      ),
    ).toBe(
      'find this label:sample-label has:pages parent:task-example project:project-example',
    )
  })

  it('returns a parsed query without status or sort fields', () => {
    expect(
      parseKanbanFilterQuery(
        'find this is:completed project:project-example sort:due',
      ),
    ).toEqual({ freeText: 'find this', projectId: 'project-example' })
  })
})
