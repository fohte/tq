import { describe, expect, it } from 'vitest'

import { extractMentionedNumbers } from '#services/task-links'

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

  it('ignores a markdown heading marker', () => {
    expect(extractMentionedNumbers('## Heading')).toEqual([])
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
