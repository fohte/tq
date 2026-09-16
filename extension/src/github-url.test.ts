import { describe, expect, it } from 'vitest'

import { githubLookupUrl } from '#github-url'

describe('githubLookupUrl', () => {
  it('returns an issue URL unchanged', () => {
    expect(githubLookupUrl('https://github.com/fohte/tq/issues/42')).toBe(
      'https://github.com/fohte/tq/issues/42',
    )
  })

  it('truncates a pull request URL with a trailing path segment', () => {
    expect(githubLookupUrl('https://github.com/fohte/tq/pull/12/files')).toBe(
      'https://github.com/fohte/tq/pull/12',
    )
  })

  it('truncates a query string', () => {
    expect(
      githubLookupUrl('https://github.com/fohte/tq/pull/12?tab=readme-ov-file'),
    ).toBe('https://github.com/fohte/tq/pull/12')
  })

  it('truncates a hash', () => {
    expect(
      githubLookupUrl('https://github.com/fohte/tq/issues/42#issuecomment-1'),
    ).toBe('https://github.com/fohte/tq/issues/42')
  })

  it('returns null for a non-issue/PR GitHub page', () => {
    expect(githubLookupUrl('https://github.com/fohte/tq')).toBeNull()
  })

  it('returns null for a non-GitHub URL', () => {
    expect(githubLookupUrl('https://example.com/fohte/tq/issues/42')).toBeNull()
  })
})
