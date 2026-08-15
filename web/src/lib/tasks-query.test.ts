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

  it('appends a label: token when tag is set', () => {
    expect(
      buildTasksQuery({
        sortBy: 'updated',
        showCompleted: false,
        projectId: undefined,
        tag: 'dev:tq',
      }),
    ).toBe('is:todo is:in_progress sort:updated label:dev:tq')
  })

  it('appends extra tokens verbatim after the known fields', () => {
    expect(
      buildTasksQuery({
        sortBy: 'updated',
        showCompleted: false,
        projectId: undefined,
        extra: 'has:pages is:completed',
      }),
    ).toBe('is:todo is:in_progress sort:updated has:pages is:completed')
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

  it('keeps an unrecognized sort: value as extra instead of dropping it', () => {
    expect(parseTasksQuery('sort:due')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
      extra: 'sort:due',
    })
  })

  it('keeps an empty project: value as extra instead of dropping it', () => {
    expect(parseTasksQuery('project:')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
      extra: 'project:',
    })
  })

  it('reads a label: token as tag', () => {
    expect(parseTasksQuery('label:dev:tq')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
      tag: 'dev:tq',
    })
  })

  it('keeps an empty label: value as extra instead of dropping it', () => {
    expect(parseTasksQuery('label:')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
      extra: 'label:',
    })
  })

  it('round-trips a tag-scoped state', () => {
    const state = {
      sortBy: 'updated' as const,
      showCompleted: false,
      projectId: undefined,
      tag: 'urgent',
    }
    expect(parseTasksQuery(buildTasksQuery(state))).toEqual(state)
  })

  it('preserves an unrecognized token (e.g. has:pages) as extra', () => {
    expect(parseTasksQuery('sort:updated has:pages')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
      extra: 'has:pages',
    })
  })

  it('preserves free text without a colon as extra', () => {
    expect(parseTasksQuery('sort:updated deploy')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
      extra: 'deploy',
    })
  })

  it('preserves an unrecognized is: value (e.g. is:completed) as extra', () => {
    expect(parseTasksQuery('is:completed')).toEqual({
      sortBy: 'updated',
      showCompleted: true,
      projectId: undefined,
      extra: 'is:completed',
    })
  })

  it('keeps extra tokens through a structured-field edit round-trip', () => {
    const state = {
      sortBy: 'created' as const,
      showCompleted: false,
      projectId: 'proj-1',
      extra: 'has:pages',
    }
    expect(parseTasksQuery(buildTasksQuery(state))).toEqual(state)
  })
})
