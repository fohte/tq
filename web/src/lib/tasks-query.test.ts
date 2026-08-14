import { describe, expect, it } from 'vitest'

import { buildTasksQuery, parseTasksQuery } from '#lib/tasks-query'

describe('buildTasksQuery', () => {
  it('encodes the hide-completed default state', () => {
    expect(
      buildTasksQuery({
        sortBy: 'updated',
        showCompleted: false,
        projectId: undefined,
      }),
    ).toBe('is:todo is:in_progress sort:updated')
  })

  it('omits the is: tokens when showCompleted is true', () => {
    expect(
      buildTasksQuery({
        sortBy: 'updated',
        showCompleted: true,
        projectId: undefined,
      }),
    ).toBe('sort:updated')
  })

  it('appends a project: token when projectId is set', () => {
    expect(
      buildTasksQuery({
        sortBy: 'created',
        showCompleted: false,
        projectId: 'proj-1',
      }),
    ).toBe('is:todo is:in_progress sort:created project:proj-1')
  })
})

describe('parseTasksQuery', () => {
  it('treats an empty query as show-all, sorted by updated', () => {
    expect(parseTasksQuery('')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
    })
  })

  it('round-trips a hide-completed, project-scoped, created-sorted state', () => {
    const state = {
      sortBy: 'created' as const,
      showCompleted: false,
      projectId: 'proj-1',
    }
    expect(parseTasksQuery(buildTasksQuery(state))).toEqual(state)
  })

  it('round-trips the show-all state', () => {
    const state = {
      sortBy: 'updated' as const,
      showCompleted: true,
      projectId: undefined,
    }
    expect(parseTasksQuery(buildTasksQuery(state))).toEqual(state)
  })

  it('ignores an unrecognized sort: value', () => {
    expect(parseTasksQuery('sort:due')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
    })
  })

  it('ignores an empty project: value', () => {
    expect(parseTasksQuery('project:')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
    })
  })
})
