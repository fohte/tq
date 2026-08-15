import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { projectUrlProvider } from '#lib/inline-reference/providers/project-url'

describe('projectUrlProvider.findMatches', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { host: 'tq.fohte.net' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function urls(text: string): string[] {
    return projectUrlProvider.findMatches(text).map((m) => m.raw)
  }

  it('finds a project URL', () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(
      urls(`see https://tq.fohte.net/projects/${uuid} for context`),
    ).toEqual([`https://tq.fohte.net/projects/${uuid}`])
  })

  it('ignores a URL on a different host', () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(urls(`see https://evil.example.com/projects/${uuid}`)).toEqual([])
  })

  it('returns no matches when there are none', () => {
    expect(projectUrlProvider.findMatches('no references here')).toEqual([])
  })

  it('ignores a URL for a different resource', () => {
    expect(urls('see https://tq.fohte.net/tasks/123')).toEqual([])
  })

  it('ignores a URL with a trailing path segment', () => {
    expect(urls('see https://tq.fohte.net/projects/abc-123/board')).toEqual([])
  })

  it('stops before a query string, leaving it as trailing text', () => {
    expect(urls('see https://tq.fohte.net/projects/abc-123?tab=board')).toEqual(
      ['https://tq.fohte.net/projects/abc-123'],
    )
  })

  it('reports the raw text and start/end offsets of the match', () => {
    expect(
      projectUrlProvider.findMatches(
        'see https://tq.fohte.net/projects/abc-123 here',
      ),
    ).toEqual([
      {
        start: 4,
        end: 41,
        raw: 'https://tq.fohte.net/projects/abc-123',
        data: { id: 'abc-123' },
      },
    ])
  })
})
