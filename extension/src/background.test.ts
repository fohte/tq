import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// background.ts registers a chrome.runtime.onMessage listener at import
// time, so `chrome` must be stubbed before each dynamic import.
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

    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('resolves to the linked task, narrowed to just id and number', async () => {
    const { lookupTask } = await import('#background')
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        task: { id: 'uuid-1', number: 42, title: 'some task title' },
      }),
    )

    const result = await lookupTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result._unsafeUnwrap()).toEqual({ id: 'uuid-1', number: 42 })
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

    expect(result._unsafeUnwrapErr()).toEqual(
      new Error('tq lookup returned status 500'),
    )
  })

  it('errs when the fetch itself rejects', async () => {
    const { lookupTask } = await import('#background')
    const networkError = new Error('network down')
    const fetchImpl = vi.fn().mockRejectedValue(networkError)

    const result = await lookupTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result._unsafeUnwrapErr()).toEqual(
      new Error('tq lookup request failed', { cause: networkError }),
    )
  })
})

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean

async function importAndCaptureListener(): Promise<MessageListener> {
  const addListener = vi.fn()
  vi.stubGlobal('chrome', { runtime: { onMessage: { addListener } } })
  await import('#background')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- vi.fn()'s recorded call args are untyped; background.ts's own addListener call site is the runtime guarantee for this shape
  const [listener] = addListener.mock.calls[0] as [MessageListener]
  return listener
}

describe('onMessage listener', () => {
  it('ignores a message that is not a lookup request', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const listener = await importAndCaptureListener()
    const sendResponse = vi.fn()

    const handled = listener({ type: 'something-else' }, {}, sendResponse)

    expect(handled).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
  })

  it('responds with the linked task for a valid lookup message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ task: { id: 'uuid-1', number: 42 } }),
        ),
    )
    const listener = await importAndCaptureListener()
    const sendResponse = vi.fn()

    const handled = listener(
      { type: 'lookup', url: 'https://github.com/fohte/tq/issues/42' },
      {},
      sendResponse,
    )

    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        task: { id: 'uuid-1', number: 42 },
      })
    })
  })

  it('responds with ok: false when the lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    const listener = await importAndCaptureListener()
    const sendResponse = vi.fn()

    listener(
      { type: 'lookup', url: 'https://github.com/fohte/tq/issues/42' },
      {},
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: false })
    })
  })
})
