import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeLinkedTask } from '#background-test-fixtures'
import { TQ_ORIGIN } from '#config'
import { makeWebNavigationDetails } from '#web-navigation-test-fixtures'

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
  vi.stubGlobal('chrome', {
    runtime: { onMessage: { addListener: vi.fn() } },
    webNavigation: { onBeforeNavigate: { addListener: vi.fn() } },
    tabs: {},
  })
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
      `${TQ_ORIGIN}/api/github/link?url=https%3A%2F%2Fgithub.com%2Ffohte%2Ftq%2Fissues%2F42`,
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
        task: { ...makeLinkedTask(), title: 'some task title' },
      }),
    )

    const result = await lookupTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result._unsafeUnwrap()).toEqual(makeLinkedTask())
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

describe('createTask', () => {
  it('posts the URL to the from-github endpoint with cookie credentials', async () => {
    const { createTask } = await import('#background')
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ created: true, task: makeLinkedTask() }, 201),
      )

    await createTask('https://github.com/fohte/tq/issues/42', fetchImpl)

    expect(fetchImpl).toHaveBeenCalledWith(
      `${TQ_ORIGIN}/api/tasks/from-github`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
      },
    )
  })

  it('resolves to the created task, narrowed to just id and number, regardless of the created flag', async () => {
    const { createTask } = await import('#background')
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          created: false,
          task: { ...makeLinkedTask(), title: 'some task title' },
        },
        200,
      ),
    )

    const result = await createTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result._unsafeUnwrap()).toEqual(makeLinkedTask())
  })

  it('errs on a non-2xx response', async () => {
    const { createTask } = await import('#background')
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'nope' }, 400))

    const result = await createTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result._unsafeUnwrapErr()).toEqual(
      new Error('tq create returned status 400'),
    )
  })

  it('errs when the fetch itself rejects', async () => {
    const { createTask } = await import('#background')
    const networkError = new Error('network down')
    const fetchImpl = vi.fn().mockRejectedValue(networkError)

    const result = await createTask(
      'https://github.com/fohte/tq/issues/42',
      fetchImpl,
    )

    expect(result._unsafeUnwrapErr()).toEqual(
      new Error('tq create request failed', { cause: networkError }),
    )
  })
})

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean

function assertDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined()
}

async function importAndCaptureListener(): Promise<MessageListener> {
  const addListener = vi.fn<(listener: MessageListener) => void>()
  vi.stubGlobal('chrome', {
    runtime: { onMessage: { addListener } },
    webNavigation: { onBeforeNavigate: { addListener: vi.fn() } },
    tabs: {},
  })
  await import('#background')
  const call = addListener.mock.calls[0]
  assertDefined(call)
  const [listener] = call
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
      vi.fn().mockResolvedValue(jsonResponse({ task: makeLinkedTask() })),
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
        task: makeLinkedTask(),
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

  it('responds with the created task for a valid create message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ created: true, task: makeLinkedTask() }, 201),
        ),
    )
    const listener = await importAndCaptureListener()
    const sendResponse = vi.fn()

    const handled = listener(
      { type: 'create', url: 'https://github.com/fohte/tq/issues/42' },
      {},
      sendResponse,
    )

    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        task: makeLinkedTask(),
      })
    })
  })

  it('responds with ok: false when creation fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    const listener = await importAndCaptureListener()
    const sendResponse = vi.fn()

    listener(
      { type: 'create', url: 'https://github.com/fohte/tq/issues/42' },
      {},
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: false })
    })
  })
})

describe('webNavigation.onBeforeNavigate listener', () => {
  const TQ_URL = `${TQ_ORIGIN}/tasks/42`

  async function importAndCaptureNavigationListener(
    tabs: Record<string, unknown>,
  ): Promise<
    (details: chrome.webNavigation.WebNavigationBaseCallbackDetails) => void
  > {
    const addListener =
      vi.fn<
        (
          listener: (
            details: chrome.webNavigation.WebNavigationBaseCallbackDetails,
          ) => void,
        ) => void
      >()
    vi.stubGlobal('chrome', {
      runtime: { onMessage: { addListener: vi.fn() } },
      webNavigation: { onBeforeNavigate: { addListener } },
      tabs,
    })
    await import('#background')
    const call = addListener.mock.calls[0]
    assertDefined(call)
    const [listener] = call
    return listener
  }

  it('logs a warning when handing a link to tq fails', async () => {
    const failure = new Error('tabs unavailable')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const listener = await importAndCaptureNavigationListener({
      get: vi.fn().mockRejectedValue(failure),
    })

    listener(makeWebNavigationDetails({ url: TQ_URL }))

    await vi.waitFor(() => {
      expect(warn.mock.calls).toEqual([
        [
          'tq: link handoff failed',
          new Error('tq link handoff failed', { cause: failure }),
        ],
      ])
    })
  })
})
