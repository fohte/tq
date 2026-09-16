import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// background.ts registers a chrome.runtime.onMessage listener at import
// time, which requires a `chrome` global that jsdom doesn't provide — stub
// it before each dynamic import, matching content.test.ts's approach for
// the same reason.
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('chrome', { runtime: { onMessage: { addListener: vi.fn() } } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lookupTask', () => {
  it('requests the link endpoint with the encoded URL and cookie credentials', async () => {
    const { lookupTask } = await import('#background')
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ task: null }))

    await lookupTask('https://github.com/fohte/tq/issues/42', fetchImpl)

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://tq.fohte.net/api/github/link?url=https%3A%2F%2Fgithub.com%2Ffohte%2Ftq%2Fissues%2F42',
      { credentials: 'include' },
    )
  })

  it('resolves to null when the URL is unlinked', async () => {
    const { lookupTask } = await import('#background')
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ task: null }))

    const result = await lookupTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result.isOk() && result.value).toBeNull()
  })

  it('resolves to the linked task', async () => {
    const { lookupTask } = await import('#background')
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ task: { id: 'uuid-1', number: 42 } }))

    const result = await lookupTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result.isOk() && result.value).toEqual({ id: 'uuid-1', number: 42 })
  })

  it('errs on a non-200 response', async () => {
    const { lookupTask } = await import('#background')
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'nope' }, 500))

    const result = await lookupTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result.isErr()).toBe(true)
  })

  it('errs when the fetch itself rejects', async () => {
    const { lookupTask } = await import('#background')
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await lookupTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result.isErr()).toBe(true)
  })
})
