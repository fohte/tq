import { describe, expect, it } from 'vitest'

import { projectUrlProvider } from '#lib/inline-reference/providers/project-url'

describe('projectUrlProvider.findMatches', () => {
  function urls(text: string): string[] {
    return projectUrlProvider.findMatches(text).map((m) => m.data.url)
  }

  it('finds a project URL', () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(
      urls(`see https://tq.fohte.net/projects/${uuid} for context`),
    ).toEqual([`https://tq.fohte.net/projects/${uuid}`])
  })

  it('matches any host, since the API is the authoritative domain check', () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(urls(`see http://localhost:5173/projects/${uuid}`)).toEqual([
      `http://localhost:5173/projects/${uuid}`,
    ])
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
        data: { url: 'https://tq.fohte.net/projects/abc-123' },
      },
    ])
  })
})
