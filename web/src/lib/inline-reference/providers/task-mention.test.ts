import { describe, expect, it } from 'vitest'

import { taskMentionProvider } from '#lib/inline-reference/providers/task-mention'

// These mirror api/src/services/task-links.test.ts's extractMentionedNumbers
// cases exactly: this pattern must match the server's boundary rules, or a
// mention would render as a chip without being linked (or vice versa).
describe('taskMentionProvider.findMatches', () => {
  function numbers(text: string): number[] {
    return taskMentionProvider.findMatches(text).map((m) => m.data.number)
  }

  it('finds a single mention', () => {
    expect(numbers('see #123 for context')).toEqual([123])
  })

  it('finds multiple distinct mentions', () => {
    expect(numbers('blocked by #1 and #2')).toEqual([1, 2])
  })

  it('does not dedupe repeated mentions (each occurrence gets its own chip)', () => {
    expect(numbers('#5 again, see #5')).toEqual([5, 5])
  })

  it('returns no matches when there are none', () => {
    expect(taskMentionProvider.findMatches('no references here')).toEqual([])
  })

  it('ignores a mention preceded by another hash, e.g. a markdown heading marker', () => {
    expect(numbers('##123')).toEqual([])
  })

  it('ignores a hash directly preceded by a word character', () => {
    expect(numbers('color#123')).toEqual([])
  })

  it('ignores a mention immediately followed by a word character', () => {
    expect(numbers('#123abc')).toEqual([])
  })

  it('finds a mention at the start of the text', () => {
    expect(numbers('#42 is done')).toEqual([42])
  })

  it('finds a mention wrapped in punctuation', () => {
    expect(numbers('(#7)')).toEqual([7])
  })

  it('reports the raw text and start/end offsets of the match', () => {
    expect(taskMentionProvider.findMatches('see #123 here')).toEqual([
      { start: 4, end: 8, raw: '#123', data: { number: 123 } },
    ])
  })
})
