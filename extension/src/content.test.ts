import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Wrapped in its own container per label, matching the real page: the
// header and sticky-header state labels sit in separate subtrees, not as
// siblings under one shared parent.
const LABEL_ONLY = '<div><div data-component="StateLabel">Open</div></div>'
const LABEL_WITH_CHIP =
  '<div><div data-component="StateLabel">Open</div><a data-tq-chip="empty">+ tq</a></div>'
const LABEL_WITH_LINKED_CHIP =
  '<div><div data-component="StateLabel">Open</div><a data-tq-chip="linked" href="https://tq.fohte.net/tasks/uuid-1">tq #42</a></div>'

const LOOKUP_URL = 'https://github.com/fohte/tq/issues/42'

const createdObservers: MutationObserver[] = []

class TrackingMutationObserver extends MutationObserver {
  constructor(callback: MutationCallback) {
    super(callback)
    createdObservers.push(this)
  }
}

let sendMessage: ReturnType<typeof vi.fn>

beforeEach(() => {
  document.body.innerHTML = ''
  vi.resetModules()
  vi.stubGlobal('MutationObserver', TrackingMutationObserver)
  vi.stubGlobal('location', { href: LOOKUP_URL })
  sendMessage = vi.fn()
  vi.stubGlobal('chrome', { runtime: { sendMessage } })
})

afterEach(() => {
  createdObservers.forEach((observer) => {
    observer.disconnect()
  })
  createdObservers.length = 0
  vi.unstubAllGlobals()
})

describe('content script', () => {
  it('sends a lookup message for the current page URL', async () => {
    document.body.innerHTML = LABEL_ONLY
    sendMessage.mockResolvedValue({ ok: true, task: null })

    await import('#content')

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'lookup',
      url: LOOKUP_URL,
    })
  })

  it('does not query the background on a page that is not an issue/PR', async () => {
    document.body.innerHTML = LABEL_ONLY
    vi.stubGlobal('location', { href: 'https://github.com/fohte/tq' })

    await import('#content')

    expect(sendMessage).not.toHaveBeenCalled()
    expect(document.body.innerHTML).toBe(LABEL_ONLY)
  })

  it('does not insert a chip before the lookup resolves', async () => {
    document.body.innerHTML = LABEL_ONLY
    sendMessage.mockReturnValue(new Promise<never>(() => {}))

    await import('#content')

    expect(document.body.innerHTML).toBe(LABEL_ONLY)
  })

  it('inserts a chip after every state label once the lookup resolves to unlinked', async () => {
    document.body.innerHTML = LABEL_ONLY + LABEL_ONLY
    const response = Promise.resolve({ ok: true, task: null })
    sendMessage.mockReturnValue(response)

    await import('#content')
    await response

    expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP + LABEL_WITH_CHIP)
  })

  it('inserts a linked chip once the lookup resolves to a task', async () => {
    document.body.innerHTML = LABEL_ONLY
    const response = Promise.resolve({
      ok: true,
      task: { id: 'uuid-1', number: 42 },
    })
    sendMessage.mockReturnValue(response)

    await import('#content')
    await response

    expect(document.body.innerHTML).toBe(LABEL_WITH_LINKED_CHIP)
  })

  it('does not insert a chip when the lookup fails', async () => {
    document.body.innerHTML = LABEL_ONLY
    const response = Promise.resolve({ ok: false })
    sendMessage.mockReturnValue(response)

    await import('#content')
    await response

    expect(document.body.innerHTML).toBe(LABEL_ONLY)
  })

  it('does not insert a chip when the message itself rejects', async () => {
    document.body.innerHTML = LABEL_ONLY
    const response = Promise.reject(new Error('extension context invalidated'))
    sendMessage.mockReturnValue(response)

    await import('#content')
    await response.catch(() => {})

    expect(document.body.innerHTML).toBe(LABEL_ONLY)
  })

  it('re-runs the lookup and drops the stale chip after a same-document navigation to a different issue', async () => {
    document.body.innerHTML = LABEL_ONLY
    const firstResponse = Promise.resolve({
      ok: true,
      task: { id: 'uuid-1', number: 42 },
    })
    sendMessage.mockReturnValueOnce(firstResponse)

    await import('#content')
    await firstResponse
    expect(document.body.innerHTML).toBe(LABEL_WITH_LINKED_CHIP)

    const secondResponse = Promise.resolve({ ok: true, task: null })
    sendMessage.mockReturnValueOnce(secondResponse)
    vi.stubGlobal('location', {
      href: 'https://github.com/fohte/tq/issues/43',
    })
    // Turbo morphs the DOM in place instead of reloading the content script.
    document.body.innerHTML = LABEL_ONLY

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenLastCalledWith({
        type: 'lookup',
        url: 'https://github.com/fohte/tq/issues/43',
      })
    })
    await secondResponse

    await vi.waitFor(() => {
      expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP)
    })
  })

  it('does not insert a second chip when the observer reruns after an unrelated mutation', async () => {
    document.body.innerHTML = LABEL_ONLY
    const response = Promise.resolve({ ok: true, task: null })
    sendMessage.mockReturnValue(response)

    await import('#content')
    await response
    expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP)

    const filler = document.createElement('div')
    document.body.append(filler)
    filler.remove()

    await vi.waitFor(() => {
      expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP)
    })
  })

  it('reinserts the chip after the state label node is replaced', async () => {
    document.body.innerHTML = LABEL_ONLY
    const response = Promise.resolve({ ok: true, task: null })
    sendMessage.mockReturnValue(response)

    await import('#content')
    await response
    expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP)

    document.body.innerHTML = LABEL_ONLY

    await vi.waitFor(() => {
      expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP)
    })
  })
})
