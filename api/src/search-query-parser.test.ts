import { describe, expect, it } from 'vitest'

import { buildSearchQuery, parseSearchQuery } from '#search-query-parser'

describe('parseSearchQuery', () => {
  it('extracts free text when no prefixes are present', () => {
    expect(parseSearchQuery('buy groceries')).toEqual({
      freeText: 'buy groceries',
    })
  })

  it('parses is: prefix into status filter', () => {
    const result = parseSearchQuery('is:todo')
    expect(result.status).toEqual(['todo'])
    expect(result.freeText).toBe('')
  })

  it('parses is:in_progress', () => {
    expect(parseSearchQuery('is:in_progress').status).toEqual(['in_progress'])
  })

  it('parses is:completed', () => {
    expect(parseSearchQuery('is:completed').status).toEqual(['completed'])
  })

  it('parses multiple is: prefixes into a combined status filter', () => {
    expect(parseSearchQuery('is:todo is:in_progress')).toEqual({
      freeText: '',
      status: ['todo', 'in_progress'],
    })
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

  it('parses commitment: prefix', () => {
    expect(parseSearchQuery('commitment:active').commitment).toBe('active')
  })

  it('treats invalid commitment: value as free text', () => {
    const result = parseSearchQuery('commitment:invalid')
    expect(result.commitment).toBeUndefined()
    expect(result.freeText).toBe('commitment:invalid')
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
    expect(parseSearchQuery('sort:estimate').sortBy).toBe('estimate')
  })

  it('treats invalid sort: value as free text', () => {
    const result = parseSearchQuery('sort:invalid')
    expect(result.sortBy).toBeUndefined()
    expect(result.freeText).toBe('sort:invalid')
  })

  it('combines free text with multiple prefixes', () => {
    const result = parseSearchQuery(
      'deploy is:todo label:dev context:work commitment:active',
    )
    expect(result.freeText).toBe('deploy')
    expect(result.status).toEqual(['todo'])
    expect(result.label).toBe('dev')
    expect(result.context).toBe('work')
    expect(result.commitment).toBe('active')
  })

  it('handles free text interspersed with prefixes', () => {
    const result = parseSearchQuery('fix is:todo urgent bug')
    expect(result.freeText).toBe('fix urgent bug')
    expect(result.status).toEqual(['todo'])
  })

  it('handles quoted strings as single free text token', () => {
    const result = parseSearchQuery('"fix bug" is:todo')
    expect(result.freeText).toBe('fix bug')
    expect(result.status).toEqual(['todo'])
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

describe('buildSearchQuery', () => {
  it('builds a query string from a ParsedQuery', () => {
    expect(
      buildSearchQuery({
        freeText: 'deploy',
        status: ['todo'],
        label: 'dev',
        context: 'work',
        commitment: 'active',
        hasPages: true,
        hasComments: true,
        parentId: 'parent-1',
        projectId: 'proj-1',
        sortBy: 'due',
      }),
    ).toBe(
      'deploy is:todo label:dev context:work commitment:active has:pages has:comments parent:parent-1 project:proj-1 sort:due',
    )
  })

  it('omits freeText when empty', () => {
    expect(buildSearchQuery({ freeText: '', status: ['todo'] })).toBe('is:todo')
  })

  it('quotes values containing spaces', () => {
    expect(buildSearchQuery({ freeText: '', label: 'my label' })).toBe(
      'label:"my label"',
    )
  })
})

describe('parseSearchQuery and buildSearchQuery round-trip', () => {
  it('round-trips multiple status values', () => {
    const q = 'is:todo is:in_progress'
    expect(parseSearchQuery(buildSearchQuery(parseSearchQuery(q)))).toEqual({
      freeText: '',
      status: ['todo', 'in_progress'],
    })
  })

  it('round-trips a quoted value containing spaces', () => {
    const q = 'label:"my label" project:"my project"'
    expect(parseSearchQuery(buildSearchQuery(parseSearchQuery(q)))).toEqual({
      freeText: '',
      label: 'my label',
      projectId: 'my project',
    })
  })

  it('round-trips a commitment value', () => {
    const q = 'commitment:someday'
    expect(parseSearchQuery(buildSearchQuery(parseSearchQuery(q)))).toEqual({
      freeText: '',
      commitment: 'someday',
    })
  })

  it('round-trips free text mixed with tokens', () => {
    const q = 'fix is:todo urgent bug label:dev'
    expect(parseSearchQuery(buildSearchQuery(parseSearchQuery(q)))).toEqual({
      freeText: 'fix urgent bug',
      status: ['todo'],
      label: 'dev',
    })
  })

  it('round-trips a value containing a literal double quote', () => {
    const query = { freeText: '', label: 'she said "hi"' }
    expect(parseSearchQuery(buildSearchQuery(query))).toEqual(query)
  })

  it('round-trips a value containing a literal single quote', () => {
    const query = { freeText: '', label: "Bob's project" }
    expect(parseSearchQuery(buildSearchQuery(query))).toEqual(query)
  })
})
