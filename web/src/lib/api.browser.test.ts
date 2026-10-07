import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '#lib/api'
import { getScreenId } from '#lib/screen-id'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api author header', () => {
  it('uses one screen ID for each request from this page', async () => {
    const authors: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        authors.push(new Headers(init?.headers).get('X-Author') ?? '')
        return Promise.resolve(
          new Response('[]', {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    await api.api.tasks.$get({
      query: { context: 'all', status: 'all', limit: 'unlimited' },
    })
    await api.api.tasks.$get({
      query: { context: 'all', status: 'all', limit: 'unlimited' },
    })

    expect(authors).toEqual([
      `human:${getScreenId()}`,
      `human:${getScreenId()}`,
    ])
  })
})
