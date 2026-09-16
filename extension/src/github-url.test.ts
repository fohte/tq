import { describe, expect, it } from 'vitest'

import { githubLookupUrl } from '#github-url'

describe('githubLookupUrl', () => {
  it.each([
    [
      'an issue URL unchanged',
      'https://github.com/fohte/tq/issues/42',
      'https://github.com/fohte/tq/issues/42',
    ],
    [
      'a pull request URL with a trailing path segment',
      'https://github.com/fohte/tq/pull/12/files',
      'https://github.com/fohte/tq/pull/12',
    ],
    [
      'a query string',
      'https://github.com/fohte/tq/pull/12?tab=readme-ov-file',
      'https://github.com/fohte/tq/pull/12',
    ],
    [
      'a hash',
      'https://github.com/fohte/tq/issues/42#issuecomment-1',
      'https://github.com/fohte/tq/issues/42',
    ],
    ['a non-issue/PR GitHub page', 'https://github.com/fohte/tq', null],
    ['a non-GitHub URL', 'https://example.com/fohte/tq/issues/42', null],
  ])('handles %s', (_label, url, expected) => {
    expect(githubLookupUrl(url)).toBe(expected)
  })
})
