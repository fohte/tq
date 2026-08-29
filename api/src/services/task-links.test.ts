import { describe, expect, it } from 'vitest'

import { APP_DOMAIN } from '#env'
import {
  extractMentionedNumbers,
  extractMentionedTaskRefs,
} from '#services/task-links'

describe('extractMentionedNumbers', () => {
  it('extracts a single mention', () => {
    expect(extractMentionedNumbers('see #123 for context')).toEqual([123])
  })

  it('extracts multiple distinct mentions', () => {
    expect(extractMentionedNumbers('blocked by #1 and #2')).toEqual([1, 2])
  })

  it('dedupes repeated mentions of the same number', () => {
    expect(extractMentionedNumbers('#5 again, see #5')).toEqual([5])
  })

  it('returns an empty array when there are no mentions', () => {
    expect(extractMentionedNumbers('no references here')).toEqual([])
  })

  it('ignores a mention preceded by another hash, e.g. a markdown heading marker', () => {
    expect(extractMentionedNumbers('##123')).toEqual([])
  })

  it('ignores a hash directly preceded by a word character', () => {
    expect(extractMentionedNumbers('color#123')).toEqual([])
  })

  it('ignores a mention immediately followed by a word character', () => {
    expect(extractMentionedNumbers('#123abc')).toEqual([])
  })

  it('extracts a mention at the start of the text', () => {
    expect(extractMentionedNumbers('#42 is done')).toEqual([42])
  })

  it('extracts a mention wrapped in punctuation', () => {
    expect(extractMentionedNumbers('(#7)')).toEqual([7])
  })
})

describe('extractMentionedTaskRefs', () => {
  it('extracts a number from a `#N` mention', async () => {
    expect(await extractMentionedTaskRefs('see #123')).toEqual([
      { kind: 'number', value: 123 },
    ])
  })

  it('extracts a number from a numeric task URL', async () => {
    expect(
      await extractMentionedTaskRefs(`see https://${APP_DOMAIN}/tasks/123`),
    ).toEqual([{ kind: 'number', value: 123 }])
  })

  it('extracts an id from a uuid task URL', async () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(
      await extractMentionedTaskRefs(`see https://${APP_DOMAIN}/tasks/${uuid}`),
    ).toEqual([{ kind: 'id', value: uuid }])
  })

  it('dedupes a number mentioned both as `#N` and as a task URL', async () => {
    expect(
      await extractMentionedTaskRefs(
        `see #123 and https://${APP_DOMAIN}/tasks/123`,
      ),
    ).toEqual([{ kind: 'number', value: 123 }])
  })

  it('combines numbers and ids from mixed mentions', async () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(
      await extractMentionedTaskRefs(
        `see #1, https://${APP_DOMAIN}/tasks/2, and https://${APP_DOMAIN}/tasks/${uuid}`,
      ),
    ).toEqual([
      { kind: 'number', value: 1 },
      { kind: 'number', value: 2 },
      { kind: 'id', value: uuid },
    ])
  })

  it('treats a numeric task URL ref past the Postgres integer range as an id, not a number', async () => {
    expect(
      await extractMentionedTaskRefs(
        `see https://${APP_DOMAIN}/tasks/99999999999`,
      ),
    ).toEqual([{ kind: 'id', value: '99999999999' }])
  })

  it('ignores a task URL with a trailing path segment', async () => {
    expect(
      await extractMentionedTaskRefs(
        `see https://${APP_DOMAIN}/tasks/123/pages/abc`,
      ),
    ).toEqual([])
  })

  it('ignores a mention inside a code span', async () => {
    expect(await extractMentionedTaskRefs('see `#123` here')).toEqual([])
  })

  it('ignores a mention inside a fenced code block', async () => {
    expect(await extractMentionedTaskRefs('```\n$ tq show #123\n```')).toEqual(
      [],
    )
  })

  it('ignores a mention inside an indented code block', async () => {
    expect(await extractMentionedTaskRefs('    $ tq show #123')).toEqual([])
  })

  it('ignores a mention inside a link display text whose href points elsewhere', async () => {
    expect(
      await extractMentionedTaskRefs(
        '[fix #123](https://github.com/example/example/pull/1)',
      ),
    ).toEqual([])
  })

  it('extracts a number from a labeled link whose href is a numeric task URL', async () => {
    expect(
      await extractMentionedTaskRefs(
        `see [details](https://${APP_DOMAIN}/tasks/123)`,
      ),
    ).toEqual([{ kind: 'number', value: 123 }])
  })

  it('dedupes a number referenced both as a labeled link and a bare task URL', async () => {
    expect(
      await extractMentionedTaskRefs(
        `see [details](https://${APP_DOMAIN}/tasks/123) and https://${APP_DOMAIN}/tasks/123`,
      ),
    ).toEqual([{ kind: 'number', value: 123 }])
  })

  it('returns an empty array instead of throwing when the input fails to parse', async () => {
    // Thousands of nested blockquote markers overflow the markdown parser
    // (see markdown-parser.test.ts); this must degrade to no refs rather
    // than fail the whole sync.
    expect(await extractMentionedTaskRefs('> '.repeat(5000) + 'x')).toEqual([])
  })
})
