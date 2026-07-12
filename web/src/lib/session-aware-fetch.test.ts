import { sessionAwareFetch } from '@web/lib/session-aware-fetch'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('sessionAwareFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards the response when the request does not redirect', async () => {
    const response = new Response('ok', { status: 200 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const result = await sessionAwareFetch('/api/tasks', { method: 'GET' })

    expect(result).toBe(response)
  })

  it("always overrides the request's redirect mode to 'manual'", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await sessionAwareFetch('/api/tasks', { method: 'GET', redirect: 'follow' })

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/tasks', {
      method: 'GET',
      redirect: 'manual',
    })
  })

  it('reloads the page and never resolves when the response is an opaque redirect', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double only exposing the `type` field sessionAwareFetch reads
    const opaqueRedirectResponse = { type: 'opaqueredirect' } as Response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse))
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })

    const pending = Symbol('pending')
    const result = await Promise.race([
      sessionAwareFetch('/api/tasks'),
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(pending)
        }, 0)
      }),
    ])

    expect(result).toBe(pending)
    expect(reload).toHaveBeenCalledExactlyOnceWith()
  })
})
