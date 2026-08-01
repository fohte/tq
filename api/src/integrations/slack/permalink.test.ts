import { describe, expect, it } from 'vitest'

import { parseSlackPermalink } from '#integrations/slack/permalink'

describe('parseSlackPermalink', () => {
  it('parses a permalink to a top-level message', () => {
    const ref = parseSlackPermalink(
      'https://acme.slack.com/archives/C0123456789/p1753880000123456',
    )._unsafeUnwrap()

    expect(ref).toEqual({
      channelId: 'C0123456789',
      ts: '1753880000.123456',
      threadTs: null,
    })
  })

  it('parses a permalink to a thread reply', () => {
    const ref = parseSlackPermalink(
      'https://acme.slack.com/archives/C0123456789/p1753880000123456?thread_ts=1753879999.000100&cid=C0123456789',
    )._unsafeUnwrap()

    expect(ref).toEqual({
      channelId: 'C0123456789',
      ts: '1753880000.123456',
      threadTs: '1753879999.000100',
    })
  })

  it.each([
    ['a non-Slack URL', 'https://example.com/archives/C0123456789/p123'],
    [
      'a URL missing the archives segment',
      'https://acme.slack.com/C0123456789/p1753880000123456',
    ],
    [
      'a URL with a non-p-prefixed message segment',
      'https://acme.slack.com/archives/C0123456789/1753880000123456',
    ],
    [
      'a URL with too few digits to be a ts',
      'https://acme.slack.com/archives/C0123456789/p123',
    ],
    ['plain text', 'not a url'],
  ])('rejects %s', (_label, url) => {
    const error = parseSlackPermalink(url)._unsafeUnwrapErr()
    expect(error.message).toBe(`Not a Slack permalink: ${url}`)
  })
})
