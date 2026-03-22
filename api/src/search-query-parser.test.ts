import { parseSearchQuery } from '@api/search-query-parser'
import { describe, expect, it } from 'vitest'

describe('parseSearchQuery', () => {
  it('extracts free text when no prefixes are present', () => {
    expect(parseSearchQuery('buy groceries')).toEqual({
      freeText: 'buy groceries',
    })
  })

  it('parses is: prefix into status filter', () => {
    const result = parseSearchQuery('is:todo')
    expect(result.status).toBe('todo')
    expect(result.freeText).toBe('')
  })

  it('parses is:in_progress', () => {
    expect(parseSearchQuery('is:in_progress').status).toBe('in_progress')
  })

  it('parses is:completed', () => {
    expect(parseSearchQuery('is:completed').status).toBe('completed')
  })

  it('treats invalid is: value as free text', () => {
    const result = parseSearchQuery('is:invalid')
    expect(result.status).toBeUndefined()
    expect(result.freeText).toBe('is:invalid')
  })

  it('parses label: prefix', () => {
    expect(parseSearchQuery('label:dev').label).toBe('dev')
  })

  it('parses context: prefix', () => {
    expect(parseSearchQuery('context:work').context).toBe('work')
  })

  it('treats invalid context: value as free text', () => {
    const result = parseSearchQuery('context:invalid')
    expect(result.context).toBeUndefined()
    expect(result.freeText).toBe('context:invalid')
  })

  it('parses has:pages prefix', () => {
    expect(parseSearchQuery('has:pages').hasPages).toBe(true)
  })

  it('parses has:comments prefix', () => {
    expect(parseSearchQuery('has:comments').hasComments).toBe(true)
  })

  it('parses parent: prefix', () => {
    expect(parseSearchQuery('parent:abc-123').parentId).toBe('abc-123')
  })

  it('parses project: prefix', () => {
    expect(parseSearchQuery('project:xyz').projectId).toBe('xyz')
  })

  it('parses sort: prefix', () => {
    expect(parseSearchQuery('sort:due').sortBy).toBe('due')
    expect(parseSearchQuery('sort:created').sortBy).toBe('created')
    expect(parseSearchQuery('sort:updated').sortBy).toBe('updated')
  })

  it('treats invalid sort: value as free text', () => {
    const result = parseSearchQuery('sort:invalid')
    expect(result.sortBy).toBeUndefined()
    expect(result.freeText).toBe('sort:invalid')
  })

  it('combines free text with multiple prefixes', () => {
    const result = parseSearchQuery('deploy is:todo label:dev context:work')
    expect(result.freeText).toBe('deploy')
    expect(result.status).toBe('todo')
    expect(result.label).toBe('dev')
    expect(result.context).toBe('work')
  })

  it('handles free text interspersed with prefixes', () => {
    const result = parseSearchQuery('fix is:todo urgent bug')
    expect(result.freeText).toBe('fix urgent bug')
    expect(result.status).toBe('todo')
  })

  it('handles quoted strings as single free text token', () => {
    const result = parseSearchQuery('"fix bug" is:todo')
    expect(result.freeText).toBe('fix bug')
    expect(result.status).toBe('todo')
  })

  it('handles empty prefix value as free text', () => {
    const result = parseSearchQuery('is:')
    expect(result.status).toBeUndefined()
    expect(result.freeText).toBe('is:')
  })

  it('handles empty string', () => {
    expect(parseSearchQuery('')).toEqual({ freeText: '' })
  })
})
