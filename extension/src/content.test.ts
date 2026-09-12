import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STATE_LABEL_HTML = '<div data-component="StateLabel">Open</div>'
const CHIP_HTML = '<a data-tq-chip="empty">+ tq</a>'

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
    document.body.innerHTML = STATE_LABEL_HTML + STATE_LABEL_HTML

    await import('#content')

    expect(document.body.innerHTML).toBe(
      STATE_LABEL_HTML + CHIP_HTML + STATE_LABEL_HTML + CHIP_HTML,
    )
  })

  it('does not insert a second chip when the observer reruns after an unrelated mutation', async () => {
    document.body.innerHTML = STATE_LABEL_HTML

    await import('#content')

    const filler = document.createElement('div')
    document.body.append(filler)
    filler.remove()

    await vi.waitFor(() => {
      expect(document.body.innerHTML).toBe(STATE_LABEL_HTML + CHIP_HTML)
    })
  })

  it('reinserts the chip after the state label node is replaced', async () => {
    document.body.innerHTML = STATE_LABEL_HTML
    await import('#content')

    document.body.innerHTML = STATE_LABEL_HTML

    await vi.waitFor(() => {
      expect(document.body.innerHTML).toBe(STATE_LABEL_HTML + CHIP_HTML)
    })
  })
})
