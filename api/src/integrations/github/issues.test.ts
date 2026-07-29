import { describe, expect, it } from 'vitest'

import { parseGithubIssueUrl } from '#integrations/github/issues'

describe('parseGithubIssueUrl', () => {
  it('parses an issue URL', () => {
    const ref = parseGithubIssueUrl(
      'https://github.com/fohte/tq/issues/42',
    )._unsafeUnwrap()

    expect(ref).toEqual({ owner: 'fohte', repo: 'tq', number: 42 })
  })

  it('parses a pull request URL', () => {
    const ref = parseGithubIssueUrl(
      'https://github.com/fohte/tq/pull/7',
    )._unsafeUnwrap()

    expect(ref).toEqual({ owner: 'fohte', repo: 'tq', number: 7 })
  })

  it('parses a URL with a trailing slash', () => {
    const ref = parseGithubIssueUrl(
      'https://github.com/fohte/tq/issues/42/',
    )._unsafeUnwrap()

    expect(ref).toEqual({ owner: 'fohte', repo: 'tq', number: 42 })
  })

  it('parses a URL with a trailing query string or fragment', () => {
    expect(
      parseGithubIssueUrl(
        'https://github.com/fohte/tq/issues/42?foo=bar',
      )._unsafeUnwrap(),
    ).toEqual({ owner: 'fohte', repo: 'tq', number: 42 })

    expect(
      parseGithubIssueUrl(
        'https://github.com/fohte/tq/pull/7#issuecomment-1',
      )._unsafeUnwrap(),
    ).toEqual({ owner: 'fohte', repo: 'tq', number: 7 })
  })

  it('trims surrounding whitespace', () => {
    const ref = parseGithubIssueUrl(
      '  https://github.com/fohte/tq/issues/42  ',
    )._unsafeUnwrap()

    expect(ref).toEqual({ owner: 'fohte', repo: 'tq', number: 42 })
  })

  it.each([
    ['a non-GitHub URL', 'https://example.com/fohte/tq/issues/42'],
    ['a repo URL with no issue/pull segment', 'https://github.com/fohte/tq'],
    [
      'a URL with an unrecognized resource segment',
      'https://github.com/fohte/tq/discussions/1',
    ],
    ['a non-numeric issue number', 'https://github.com/fohte/tq/issues/abc'],
    ['plain text', 'not a url'],
  ])('rejects %s', (_label, url) => {
    const error = parseGithubIssueUrl(url)._unsafeUnwrapErr()
    expect(error.message).toBe(`Not a GitHub issue or pull request URL: ${url}`)
  })
})
