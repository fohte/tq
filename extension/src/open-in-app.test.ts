import { afterEach, describe, expect, it, vi } from 'vitest'

import { TQ_ORIGIN } from '#config'
import { openTqLinkInApp } from '#open-in-app'
import { makeTab } from '#tab-test-fixtures'
import { makeWebNavigationDetails } from '#web-navigation-test-fixtures'

type ChromeCall = 'tabs.get' | 'tabs.update' | 'tabs.remove'
type NavigationErrorDetails =
  chrome.webNavigation.WebNavigationFramedErrorCallbackDetails

const TQ_DEEP_LINK = 'tq://tq.example.test/tasks/42'

let calls: unknown[][] = []

function stubChrome(
  tabs: Record<number, chrome.tabs.Tab>,
  failures: Partial<Record<ChromeCall, Error>> = {},
  options: { deferUpdate?: boolean } = {},
): {
  updateCalled: Promise<void>
  readonly updatePromise: Promise<chrome.tabs.Tab> | undefined
  resolveUpdate: (tabId: number) => void
  emitNavigationError: (
    overrides?: Partial<chrome.webNavigation.WebNavigationBaseCallbackDetails>,
  ) => void
} {
  calls = []

  const navigationListeners = new Set<
    (details: NavigationErrorDetails) => void
  >()
  let resolveUpdateCalled: () => void = () => {}
  let resolveUpdate: (tab: chrome.tabs.Tab) => void = () => {}
  let updatePromise: Promise<chrome.tabs.Tab> | undefined
  const updateCalled = new Promise<void>((resolve) => {
    resolveUpdateCalled = resolve
  })

  const get = vi.fn((tabId: number) => {
    calls.push(['tabs.get', tabId])
    const failure = failures['tabs.get']
    return failure ? Promise.reject(failure) : Promise.resolve(tabs[tabId])
  })
  const update = vi.fn(
    (tabId: number, properties: chrome.tabs.UpdateProperties) => {
      calls.push(['tabs.update', tabId, properties])
      resolveUpdateCalled()
      const failure = failures['tabs.update']
      if (failure) return Promise.reject(failure)
      if (options.deferUpdate !== true) return Promise.resolve(tabs[tabId])

      updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })
      return updatePromise
    },
  )
  const remove = vi.fn((tabId: number) => {
    calls.push(['tabs.remove', tabId])
    const failure = failures['tabs.remove']
    return failure ? Promise.reject(failure) : Promise.resolve()
  })

  const onErrorOccurred = {
    addListener: vi.fn(
      (listener: (details: NavigationErrorDetails) => void) => {
        calls.push(['webNavigation.onErrorOccurred.addListener'])
        navigationListeners.add(listener)
      },
    ),
    removeListener: vi.fn(
      (listener: (details: NavigationErrorDetails) => void) => {
        calls.push(['webNavigation.onErrorOccurred.removeListener'])
        navigationListeners.delete(listener)
      },
    ),
  }

  vi.stubGlobal('chrome', {
    tabs: { get, update, remove },
    webNavigation: { onErrorOccurred },
  })

  return {
    updateCalled,
    get updatePromise() {
      return updatePromise
    },
    resolveUpdate: (tabId) => {
      const tab = tabs[tabId]
      if (tab !== undefined) resolveUpdate(tab)
    },
    emitNavigationError: (overrides = {}) => {
      const details: NavigationErrorDetails = {
        ...makeWebNavigationDetails({
          url: TQ_DEEP_LINK,
          ...overrides,
        }),
        documentId: 'test-document',
        error: 'test navigation error',
      }
      calls.push([
        'webNavigation.onErrorOccurred.emit',
        details.tabId,
        details.frameId,
        details.url,
      ])
      for (const listener of navigationListeners) listener(details)
    },
  }
}

async function run(
  details: chrome.webNavigation.WebNavigationBaseCallbackDetails,
): Promise<{ error: Error | null; calls: unknown[][] }> {
  const result = await openTqLinkInApp(details)
  return { error: result.isErr() ? result.error : null, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('openTqLinkInApp', () => {
  it('changes only the protocol for a tq link opened from an external page', async () => {
    stubChrome({ 9: makeTab({ id: 9, url: 'https://example.test/source' }) })

    expect(
      await run(
        makeWebNavigationDetails({
          url: `${TQ_ORIGIN}/tasks/42?view=compact#comments`,
        }),
      ),
    ).toEqual({
      error: null,
      calls: [
        ['tabs.get', 9],
        [
          'tabs.update',
          9,
          { url: 'tq://tq.example.test/tasks/42?view=compact#comments' },
        ],
      ],
    })
  })

  it('leaves a tq page navigation in the browser', async () => {
    stubChrome({ 9: makeTab({ id: 9, url: `${TQ_ORIGIN}/tasks/7` }) })

    expect(await run(makeWebNavigationDetails())).toEqual({
      error: null,
      calls: [['tabs.get', 9]],
    })
  })

  it('ignores subframe navigations', async () => {
    stubChrome({ 9: makeTab({ id: 9, url: 'https://example.test/source' }) })

    expect(await run(makeWebNavigationDetails({ frameId: 1 }))).toEqual({
      error: null,
      calls: [],
    })
  })

  it('ignores a navigation without an associated tab', async () => {
    stubChrome({})

    expect(await run(makeWebNavigationDetails({ tabId: -1 }))).toEqual({
      error: null,
      calls: [],
    })
  })

  it('ignores a lookalike host', async () => {
    stubChrome({})

    expect(
      await run(
        makeWebNavigationDetails({
          url: 'https://tq.example.test.attacker.invalid/tasks/42',
        }),
      ),
    ).toEqual({ error: null, calls: [] })
  })

  it('ignores a different port', async () => {
    stubChrome({})

    expect(
      await run(
        makeWebNavigationDetails({
          url: 'https://tq.example.test:8443/tasks/42',
        }),
      ),
    ).toEqual({ error: null, calls: [] })
  })

  it('waits for the matching tq navigation error before closing an empty tab', async () => {
    const chromeStub = stubChrome(
      {
        5: makeTab({ id: 5, url: 'https://example.test/source' }),
        9: makeTab({
          id: 9,
          openerTabId: 5,
          url: 'chrome://newtab/',
        }),
      },
      {},
      { deferUpdate: true },
    )
    const result = run(makeWebNavigationDetails())
    await chromeStub.updateCalled
    void chromeStub.updatePromise?.then(() => {
      queueMicrotask(() => {
        chromeStub.emitNavigationError()
      })
    })
    chromeStub.resolveUpdate(9)

    expect(await result).toEqual({
      error: null,
      calls: [
        ['tabs.get', 9],
        ['tabs.get', 5],
        ['webNavigation.onErrorOccurred.addListener'],
        ['tabs.update', 9, { url: TQ_DEEP_LINK }],
        ['webNavigation.onErrorOccurred.emit', 9, 0, TQ_DEEP_LINK],
        ['webNavigation.onErrorOccurred.removeListener'],
        ['tabs.remove', 9],
      ],
    })
  })

  it('ignores navigation errors that do not match the handoff', async () => {
    const chromeStub = stubChrome(
      { 9: makeTab({ id: 9, url: 'chrome://newtab/' }) },
      {},
      { deferUpdate: true },
    )
    const result = run(makeWebNavigationDetails())
    await chromeStub.updateCalled
    void chromeStub.updatePromise?.then(() => {
      queueMicrotask(() => {
        chromeStub.emitNavigationError({ tabId: 5 })
        chromeStub.emitNavigationError({ frameId: 1 })
        chromeStub.emitNavigationError({ url: `${TQ_ORIGIN}/tasks/42` })
        chromeStub.emitNavigationError()
      })
    })
    chromeStub.resolveUpdate(9)

    expect(await result).toEqual({
      error: null,
      calls: [
        ['tabs.get', 9],
        ['webNavigation.onErrorOccurred.addListener'],
        ['tabs.update', 9, { url: TQ_DEEP_LINK }],
        ['webNavigation.onErrorOccurred.emit', 5, 0, TQ_DEEP_LINK],
        ['webNavigation.onErrorOccurred.emit', 9, 1, TQ_DEEP_LINK],
        ['webNavigation.onErrorOccurred.emit', 9, 0, `${TQ_ORIGIN}/tasks/42`],
        ['webNavigation.onErrorOccurred.emit', 9, 0, TQ_DEEP_LINK],
        ['webNavigation.onErrorOccurred.removeListener'],
        ['tabs.remove', 9],
      ],
    })
  })

  it('closes a new tab with no opener after handing it off', async () => {
    const chromeStub = stubChrome(
      {
        9: makeTab({ id: 9, url: 'chrome://newtab/' }),
      },
      {},
      { deferUpdate: true },
    )
    const result = run(makeWebNavigationDetails())
    await chromeStub.updateCalled
    void chromeStub.updatePromise?.then(() => {
      queueMicrotask(() => {
        chromeStub.emitNavigationError()
      })
    })
    chromeStub.resolveUpdate(9)

    expect(await result).toEqual({
      error: null,
      calls: [
        ['tabs.get', 9],
        ['webNavigation.onErrorOccurred.addListener'],
        ['tabs.update', 9, { url: TQ_DEEP_LINK }],
        ['webNavigation.onErrorOccurred.emit', 9, 0, TQ_DEEP_LINK],
        ['webNavigation.onErrorOccurred.removeListener'],
        ['tabs.remove', 9],
      ],
    })
  })

  it('leaves a new tab open when it was opened from a tq page', async () => {
    stubChrome({
      5: makeTab({ id: 5, url: `${TQ_ORIGIN}/tasks/7` }),
      9: makeTab({ id: 9, openerTabId: 5, url: 'chrome://newtab/' }),
    })

    expect(await run(makeWebNavigationDetails())).toEqual({
      error: null,
      calls: [
        ['tabs.get', 9],
        ['tabs.get', 5],
      ],
    })
  })

  it('keeps a new tab open when handing off the link fails', async () => {
    const failure = new Error('external protocol rejected')
    stubChrome(
      {
        5: makeTab({ id: 5, url: 'https://example.test/source' }),
        9: makeTab({ id: 9, openerTabId: 5, url: 'chrome://newtab/' }),
      },
      { 'tabs.update': failure },
    )

    expect(await run(makeWebNavigationDetails())).toEqual({
      error: new Error('tq link handoff failed', { cause: failure }),
      calls: [
        ['tabs.get', 9],
        ['tabs.get', 5],
        ['webNavigation.onErrorOccurred.addListener'],
        ['tabs.update', 9, { url: TQ_DEEP_LINK }],
        ['webNavigation.onErrorOccurred.removeListener'],
      ],
    })
  })
})
