import { describe, expect, it } from 'vitest'

import { slackPermalinkProvider } from '#lib/inline-reference/providers/slack-permalink'

describe('slackPermalinkProvider.findMatches', () => {
  function urls(text: string): string[] {
    return slackPermalinkProvider.findMatches(text).map((m) => m.data.url)
  }

  it('finds a permalink', () => {
    expect(
      urls(
        'see https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100 for context',
      ),
    ).toEqual([
      'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100',
    ])
  })

  it('finds a thread reply permalink with a query string', () => {
    expect(
      urls(
        'see https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000200?thread_ts=1699999999.000100&cid=C0123ABCDEF for context',
      ),
    ).toEqual([
      'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000200?thread_ts=1699999999.000100&cid=C0123ABCDEF',
    ])
  })

  it('finds multiple distinct permalinks', () => {
    expect(
      urls(
        'see https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100 and https://fohte-team.slack.com/archives/C0456GHIJKL/p1699999999000200',
      ),
    ).toEqual([
      'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100',
      'https://fohte-team.slack.com/archives/C0456GHIJKL/p1699999999000200',
    ])
  })

  it('returns no matches when there are none', () => {
    expect(slackPermalinkProvider.findMatches('no references here')).toEqual([])
  })

  it('ignores a non-Slack URL', () => {
    expect(
      urls('see https://example.com/archives/C0123ABCDEF/p1699999999000100'),
    ).toEqual([])
  })

  it('ignores a Slack URL that is not a permalink', () => {
    expect(urls('see https://fohte-team.slack.com/')).toEqual([])
  })

  it('finds a permalink wrapped in punctuation', () => {
    expect(
      urls(
        '(https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100)',
      ),
    ).toEqual([
      'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100',
    ])
  })

  it('reports the raw text and start/end offsets of the match', () => {
    expect(
      slackPermalinkProvider.findMatches(
        'see https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100 here',
      ),
    ).toEqual([
      {
        start: 4,
        end: 71,
        raw: 'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100',
        data: {
          url: 'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100',
        },
      },
    ])
  })
})
