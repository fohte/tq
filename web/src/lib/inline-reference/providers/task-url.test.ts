import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { taskUrlProvider } from '#lib/inline-reference/providers/task-url'

describe('taskUrlProvider.findMatches', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { host: 'tq.fohte.net' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function urls(text: string): string[] {
    return taskUrlProvider.findMatches(text).map((m) => m.raw)
  }

  it('finds a numeric task URL', () => {
    expect(urls('see https://tq.fohte.net/tasks/123 for context')).toEqual([
      'https://tq.fohte.net/tasks/123',
    ])
  })

  it('finds a uuid task URL', () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(urls(`see https://tq.fohte.net/tasks/${uuid}`)).toEqual([
      `https://tq.fohte.net/tasks/${uuid}`,
    ])
  })

  it('matches the current page host', () => {
    vi.stubGlobal('location', { host: 'other.tq.example' })
    expect(urls('see http://other.tq.example/tasks/123')).toEqual([
      'http://other.tq.example/tasks/123',
    ])
  })

  it('ignores a URL on a different host', () => {
    expect(urls('see https://evil.example.com/tasks/123')).toEqual([])
  })

  it('finds multiple distinct URLs', () => {
    expect(
      urls(
        'blocked by https://tq.fohte.net/tasks/1 and https://tq.fohte.net/tasks/2',
      ),
    ).toEqual(['https://tq.fohte.net/tasks/1', 'https://tq.fohte.net/tasks/2'])
  })

  it('returns no matches when there are none', () => {
    expect(taskUrlProvider.findMatches('no references here')).toEqual([])
  })

  it('ignores a URL for a different resource', () => {
    expect(urls('see https://tq.fohte.net/projects/123')).toEqual([])
  })

  it('ignores a URL with a trailing path segment', () => {
    expect(urls('see https://tq.fohte.net/tasks/123/pages/abc')).toEqual([])
  })

  it('ignores a URL whose id is followed by a word character', () => {
    expect(urls('see https://tq.fohte.net/tasks/123abc_')).toEqual([])
  })

  it('includes an optional trailing slash', () => {
    expect(urls('see https://tq.fohte.net/tasks/123/ for context')).toEqual([
      'https://tq.fohte.net/tasks/123/',
    ])
  })

  it('stops before a query string, leaving it as trailing text', () => {
    expect(urls('see https://tq.fohte.net/tasks/123?tab=history')).toEqual([
      'https://tq.fohte.net/tasks/123',
    ])
  })

  it('stops before a fragment, leaving it as trailing text', () => {
    expect(urls('see https://tq.fohte.net/tasks/123#comment-1')).toEqual([
      'https://tq.fohte.net/tasks/123',
    ])
  })

  it('finds a URL wrapped in punctuation', () => {
    expect(urls('(https://tq.fohte.net/tasks/7)')).toEqual([
      'https://tq.fohte.net/tasks/7',
    ])
  })

  it('reports the raw text and start/end offsets of the match', () => {
    expect(
      taskUrlProvider.findMatches('see https://tq.fohte.net/tasks/123 here'),
    ).toEqual([
      {
        start: 4,
        end: 34,
        raw: 'https://tq.fohte.net/tasks/123',
        data: { id: '123' },
      },
    ])
  })
})
