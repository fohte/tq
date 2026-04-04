import {
  buildQueryFromFilters,
  parseQueryToFilters,
} from '@web/hooks/use-search'
import { describe, expect, it } from 'vitest'

describe('parseQueryToFilters', () => {
  it('parses free text only', () => {
    const result = parseQueryToFilters('armyknife')
    expect(result.freeText).toBe('armyknife')
    expect(result.filters).toEqual({})
  })

  it('parses is: status filter', () => {
    const result = parseQueryToFilters('is:todo')
    expect(result.freeText).toBe('')
    expect(result.filters.status).toBe('todo')
  })

  it('parses context: filter', () => {
    const result = parseQueryToFilters('context:work')
    expect(result.freeText).toBe('')
    expect(result.filters.context).toBe('work')
  })

  it('parses label: filter', () => {
    const result = parseQueryToFilters('label:dev:armyknife')
    expect(result.freeText).toBe('')
    expect(result.filters.label).toBe('dev:armyknife')
  })

  it('parses sort: filter', () => {
    const result = parseQueryToFilters('sort:due')
    expect(result.freeText).toBe('')
    expect(result.filters.sortBy).toBe('due')
  })

  it('parses combined query', () => {
    const result = parseQueryToFilters('is:todo context:work armyknife deploy')
    expect(result.freeText).toBe('armyknife deploy')
    expect(result.filters.status).toBe('todo')
    expect(result.filters.context).toBe('work')
  })

  it('treats invalid prefix values as free text', () => {
    const result = parseQueryToFilters('is:invalid_status')
    expect(result.freeText).toBe('is:invalid_status')
    expect(result.filters.status).toBeUndefined()
  })

  it('treats empty prefix value as free text', () => {
    const result = parseQueryToFilters('is:')
    expect(result.freeText).toBe('is:')
  })
})

describe('buildQueryFromFilters', () => {
  it('builds query with free text only', () => {
    expect(buildQueryFromFilters('armyknife', {})).toBe('armyknife')
  })

  it('builds query with status filter', () => {
    expect(buildQueryFromFilters('', { status: 'todo' })).toBe('is:todo')
  })

  it('builds query with multiple filters', () => {
    const result = buildQueryFromFilters('deploy', {
      status: 'todo',
      context: 'work',
    })
    expect(result).toBe('is:todo context:work deploy')
  })

  it('builds query with all filter types', () => {
    const result = buildQueryFromFilters('test', {
      status: 'in_progress',
      context: 'dev',
      label: 'scope:life',
      sortBy: 'due',
    })
    expect(result).toBe(
      'is:in_progress context:dev label:scope:life sort:due test',
    )
  })

  it('builds empty string when no filters and no text', () => {
    expect(buildQueryFromFilters('', {})).toBe('')
  })
})

describe('bidirectional sync: parseQueryToFilters -> buildQueryFromFilters roundtrip', () => {
  it('roundtrips a combined query', () => {
    const original = 'is:todo context:work armyknife'
    const { freeText, filters } = parseQueryToFilters(original)
    const rebuilt = buildQueryFromFilters(freeText, filters)
    expect(rebuilt).toBe(original)
  })

  it('roundtrips filters-only query', () => {
    const original = 'is:completed sort:due'
    const { freeText, filters } = parseQueryToFilters(original)
    const rebuilt = buildQueryFromFilters(freeText, filters)
    expect(rebuilt).toBe('is:completed sort:due')
  })
})
