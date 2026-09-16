import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  SESSION_RELOAD_MARKER_KEY,
  sessionAwareFetch,
} from '#lib/session-aware-fetch'

// A real browser doesn't allow redefining any property of `location`
// (including `reload`), so sessionAwareFetch calls it through this module
// instead of the global directly — mock the module rather than the global.
vi.mock('#lib/reload-page', () => ({ reloadPage: vi.fn() }))

function opaqueRedirectResponse(): Response {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double only exposing the `type` field sessionAwareFetch reads
  return { type: 'opaqueredirect' } as Response
}

// sessionAwareFetch never resolves once it decides to reload or show the
// notice, so callers race it against a macrotask to observe that instead.
const PENDING = Symbol('pending')

function raceWithPending<T>(promise: Promise<T>): Promise<T | typeof PENDING> {
  return Promise.race([
    promise,
    new Promise<typeof PENDING>((resolve) => {
      setTimeout(() => {
        resolve(PENDING)
      }, 0)
    }),
  ])
}

// The reload/notice decision is seeded once when the module is evaluated
// (see session-aware-fetch.ts), mirroring a real page load. `resetModules()`
// + re-import can't reproduce that reset here: browser-mode tests run
// against real native ESM, where re-importing the same specifier returns the
// already-evaluated module instead of re-running its top-level code. Calling
// `resetSessionAwareFetchStateForTest()` gets the same reset a real
// navigation would give for free, re-reading whatever sessionStorage holds
// at that moment. `reload-page.ts`'s mock gets reset the same way, so its
// call history must be re-fetched fresh too — the mock instance bound to a
// previous import no longer sees calls made by the newly re-imported
// sessionAwareFetch.
async function importFreshSessionAwareFetch() {
  vi.resetModules()
  const [
    { sessionAwareFetch: freshFetch, resetSessionAwareFetchStateForTest },
    { reloadPage },
  ] = await Promise.all([
    import('#lib/session-aware-fetch'),
    import('#lib/reload-page'),
  ])
  resetSessionAwareFetchStateForTest()
  const freshReloadPage = vi.mocked(reloadPage)
  freshReloadPage.mockClear()
  return { sessionAwareFetch: freshFetch, reloadPage: freshReloadPage }
}

describe('sessionAwareFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    sessionStorage.clear()
    document.body.innerHTML = ''
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

  it('clears a previous reload marker when a request succeeds', async () => {
    sessionStorage.setItem(SESSION_RELOAD_MARKER_KEY, '1')
    const { sessionAwareFetch: freshFetch } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('ok', { status: 200 })),
    )

    await freshFetch('/api/tasks')

    expect(sessionStorage.getItem(SESSION_RELOAD_MARKER_KEY)).toBeNull()
  })

  it('reloads the page on the first opaque redirect and marks the attempt, without resolving', async () => {
    const { sessionAwareFetch: freshFetch, reloadPage } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse()))

    const result = await raceWithPending(freshFetch('/api/tasks'))

    expect(result).toBe(PENDING)
    expect(reloadPage).toHaveBeenCalledExactlyOnceWith()
    expect(sessionStorage.getItem(SESSION_RELOAD_MARKER_KEY)).toBe('1')
  })

  it('shows a recovery notice instead of reloading again, when a reload was already attempted, and never resolves', async () => {
    sessionStorage.setItem(SESSION_RELOAD_MARKER_KEY, '1')
    const { sessionAwareFetch: freshFetch, reloadPage } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse()))

    const result = await raceWithPending(freshFetch('/api/tasks'))
    const notice = document.querySelector('[role="alert"]')

    expect(result).toBe(PENDING)
    expect(reloadPage).not.toHaveBeenCalled()
    expect(notice?.getAttribute('role')).toBe('alert')
    expect(notice?.textContent).toBe(
      'Session recovery failed' +
        "tq couldn't restore your session automatically. Check your Cloudflare Access login, then reload this page." +
        'Reload page',
    )
  })

  it("clicking the notice's button reloads the page", async () => {
    sessionStorage.setItem(SESSION_RELOAD_MARKER_KEY, '1')
    const { sessionAwareFetch: freshFetch, reloadPage } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse()))

    await raceWithPending(freshFetch('/api/tasks'))
    document.querySelector<HTMLButtonElement>('[role="alert"] button')?.click()

    expect(reloadPage).toHaveBeenCalledExactlyOnceWith()
  })

  it('does not show a second notice for a later request within the same already-failed page load', async () => {
    sessionStorage.setItem(SESSION_RELOAD_MARKER_KEY, '1')
    const { sessionAwareFetch: freshFetch } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse()))

    await raceWithPending(freshFetch('/api/tasks'))
    await raceWithPending(freshFetch('/api/projects'))

    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
  })

  it('does not show the notice for a later request while the first reload is still in flight', async () => {
    const { sessionAwareFetch: freshFetch, reloadPage } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse()))

    // The first call decides to reload; a second, unrelated call arrives
    // afterward but before the (mocked) reload actually navigates away.
    await raceWithPending(freshFetch('/api/tasks'))
    await raceWithPending(freshFetch('/api/projects'))

    expect(reloadPage).toHaveBeenCalledExactlyOnceWith()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('reloads exactly once for concurrent requests racing the first reload attempt, without showing the notice', async () => {
    const { sessionAwareFetch: freshFetch, reloadPage } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse()))

    // Both calls start before either resolves, mirroring a page firing
    // several queries at once.
    const [resultA, resultB] = await Promise.all([
      raceWithPending(freshFetch('/api/tasks')),
      raceWithPending(freshFetch('/api/projects')),
    ])

    expect(resultA).toBe(PENDING)
    expect(resultB).toBe(PENDING)
    expect(reloadPage).toHaveBeenCalledExactlyOnceWith()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('shows the recovery notice without ever reloading, when sessionStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { sessionAwareFetch: freshFetch, reloadPage } =
      await importFreshSessionAwareFetch()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaqueRedirectResponse()))

    const result = await raceWithPending(freshFetch('/api/tasks'))

    expect(result).toBe(PENDING)
    expect(reloadPage).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alert"]')).not.toBeNull()
  })
})
