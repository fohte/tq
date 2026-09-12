import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Wrapped in its own container per label, matching the real page: the
// header and sticky-header state labels sit in separate subtrees, not as
// siblings under one shared parent.
const LABEL_ONLY = '<div><div data-component="StateLabel">Open</div></div>'
const LABEL_WITH_CHIP =
  '<div><div data-component="StateLabel">Open</div><a data-tq-chip="empty">+ tq</a></div>'

const createdObservers: MutationObserver[] = []

class TrackingMutationObserver extends MutationObserver {
  constructor(callback: MutationCallback) {
    super(callback)
    createdObservers.push(this)
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.resetModules()
  vi.stubGlobal('MutationObserver', TrackingMutationObserver)
})

afterEach(() => {
  createdObservers.forEach((observer) => {
    observer.disconnect()
  })
  createdObservers.length = 0
  vi.unstubAllGlobals()
})

describe('content script', () => {
  it('inserts a chip after every state label on the page', async () => {
    document.body.innerHTML = LABEL_ONLY + LABEL_ONLY

    await import('#content')

    expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP + LABEL_WITH_CHIP)
  })

  it('does not insert a second chip when the observer reruns after an unrelated mutation', async () => {
    document.body.innerHTML = LABEL_ONLY

    await import('#content')

    const filler = document.createElement('div')
    document.body.append(filler)
    filler.remove()

    await vi.waitFor(() => {
      expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP)
    })
  })

  it('reinserts the chip after the state label node is replaced', async () => {
    document.body.innerHTML = LABEL_ONLY
    await import('#content')

    document.body.innerHTML = LABEL_ONLY

    await vi.waitFor(() => {
      expect(document.body.innerHTML).toBe(LABEL_WITH_CHIP)
    })
  })
})
