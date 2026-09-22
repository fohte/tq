import { afterEach, describe, expect, it, vi } from 'vitest'

import { TQ_ORIGIN } from '#config'
import { openTqLinkInApp } from '#open-in-app'
import { makeTab } from '#tab-test-fixtures'
import { makeWebNavigationDetails } from '#web-navigation-test-fixtures'

type ChromeCall = 'tabs.get' | 'tabs.update' | 'tabs.remove'

let calls: unknown[][] = []

function stubChrome(
  tabs: Record<number, chrome.tabs.Tab>,
  failures: Partial<Record<ChromeCall, Error>> = {},
): void {
  calls = []

  const get = vi.fn((tabId: number) => {
    calls.push(['tabs.get', tabId])
    const failure = failures['tabs.get']
    return failure ? Promise.reject(failure) : Promise.resolve(tabs[tabId])
  })
  const update = vi.fn(
    (tabId: number, properties: chrome.tabs.UpdateProperties) => {
      calls.push(['tabs.update', tabId, properties])
      const failure = failures['tabs.update']
      return failure ? Promise.reject(failure) : Promise.resolve(tabs[tabId])
    },
  )
  const remove = vi.fn((tabId: number) => {
    calls.push(['tabs.remove', tabId])
    const failure = failures['tabs.remove']
    return failure ? Promise.reject(failure) : Promise.resolve()
  })

  vi.stubGlobal('chrome', { tabs: { get, update, remove } })
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

  it('hands a new tab to tq and closes it after the handoff', async () => {
    stubChrome({
      5: makeTab({ id: 5, url: 'https://example.test/source' }),
      9: makeTab({
        id: 9,
        openerTabId: 5,
        url: 'chrome://newtab/',
      }),
    })

    expect(await run(makeWebNavigationDetails())).toEqual({
      error: null,
      calls: [
        ['tabs.get', 9],
        ['tabs.get', 5],
        ['tabs.update', 9, { url: 'tq://tq.example.test/tasks/42' }],
        ['tabs.remove', 9],
      ],
    })
  })

  it('closes a new tab with no opener after handing it off', async () => {
    stubChrome({ 9: makeTab({ id: 9, url: 'chrome://newtab/' }) })

    expect(await run(makeWebNavigationDetails())).toEqual({
      error: null,
      calls: [
        ['tabs.get', 9],
        ['tabs.update', 9, { url: 'tq://tq.example.test/tasks/42' }],
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
        ['tabs.update', 9, { url: 'tq://tq.example.test/tasks/42' }],
      ],
    })
  })
})
