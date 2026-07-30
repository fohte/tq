import { describe, expect, it } from 'vitest'

import { githubUrlProvider } from '#lib/inline-reference/providers/github-url'

describe('githubUrlProvider.findMatches', () => {
  function urls(text: string): string[] {
    return githubUrlProvider.findMatches(text).map((m) => m.data.url)
  }

  it('finds an issue URL', () => {
    expect(
      urls('see https://github.com/fohte/tq/issues/123 for context'),
    ).toEqual(['https://github.com/fohte/tq/issues/123'])
  })

  it('finds a pull request URL', () => {
    expect(urls('see https://github.com/fohte/tq/pull/7 for context')).toEqual([
      'https://github.com/fohte/tq/pull/7',
    ])
  })

  it('finds multiple distinct URLs', () => {
    expect(
      urls(
        'blocked by https://github.com/fohte/tq/issues/1 and https://github.com/fohte/tq/pull/2',
      ),
    ).toEqual([
      'https://github.com/fohte/tq/issues/1',
      'https://github.com/fohte/tq/pull/2',
    ])
  })

  it('returns no matches when there are none', () => {
    expect(githubUrlProvider.findMatches('no references here')).toEqual([])
  })

  it('ignores a non-GitHub URL', () => {
    expect(urls('see https://example.com/fohte/tq/issues/123')).toEqual([])
  })

  it('ignores a GitHub URL that is not an issue or pull request', () => {
    expect(urls('see https://github.com/fohte/tq')).toEqual([])
  })

  it('ignores a URL with a trailing path segment', () => {
    expect(urls('see https://github.com/fohte/tq/issues/123/comments')).toEqual(
      [],
    )
  })

  it('ignores a URL whose number is followed by a word character', () => {
    expect(urls('see https://github.com/fohte/tq/issues/123abc')).toEqual([])
  })

  it('includes an optional trailing slash', () => {
    expect(urls('see https://github.com/fohte/tq/pull/7/ for context')).toEqual(
      ['https://github.com/fohte/tq/pull/7/'],
    )
  })

  it('stops before a query string, leaving it as trailing text', () => {
    expect(
      urls('see https://github.com/fohte/tq/issues/123?tab=timeline'),
    ).toEqual(['https://github.com/fohte/tq/issues/123'])
  })

  it('finds a URL wrapped in punctuation', () => {
    expect(urls('(https://github.com/fohte/tq/issues/7)')).toEqual([
      'https://github.com/fohte/tq/issues/7',
    ])
  })

  it('reports the raw text and start/end offsets of the match', () => {
    expect(
      githubUrlProvider.findMatches(
        'see https://github.com/fohte/tq/issues/123 here',
      ),
    ).toEqual([
      {
        start: 4,
        end: 42,
        raw: 'https://github.com/fohte/tq/issues/123',
        data: { url: 'https://github.com/fohte/tq/issues/123' },
      },
    ])
  })
})
