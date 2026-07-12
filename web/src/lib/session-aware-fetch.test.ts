import { sessionAwareFetch } from '@web/lib/session-aware-fetch'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('sessionAwareFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards the response when the request does not redirect', async () => {
    const response = new Response('ok', { status: 200 })
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await sessionAwareFetch('/api/tasks', { method: 'GET' })

    expect(result).toBe(response)
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

    void sessionAwareFetch('/api/tasks')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(reload).toHaveBeenCalledExactlyOnceWith()
  })
})
