import { afterEach, describe, expect, it, vi } from 'vitest'

import { TQ_ORIGIN } from '#config'
import { reuseExistingTqTab } from '#tab-reuse'
import { makeTab } from '#tab-test-fixtures'

type MutatingCall = 'tabs.update' | 'tabs.remove' | 'windows.update'

// Records every mutating chrome call in order (including ones that then
// reject) so a test can assert the whole sequence with one equality.
let calls: unknown[][] = []

function stubChrome(
  existingTabs: chrome.tabs.Tab[],
  failures: Partial<Record<MutatingCall, Error>> = {},
): void {
  calls = []
  const record =
    (name: MutatingCall) =>
    (...args: unknown[]) => {
      calls.push([name, ...args])
      const failure = failures[name]
      return failure ? Promise.reject(failure) : Promise.resolve()
    }
  vi.stubGlobal('chrome', {
    tabs: {
      query: vi.fn().mockResolvedValue(existingTabs),
      update: vi.fn(record('tabs.update')),
      remove: vi.fn(record('tabs.remove')),
    },
    windows: { update: vi.fn(record('windows.update')) },
  })
}

async function run(
  newTab: chrome.tabs.Tab,
): Promise<{ error: Error | null; calls: unknown[][] }> {
  const result = await reuseExistingTqTab(newTab)
  return { error: result.isErr() ? result.error : null, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const TQ_URL = `${TQ_ORIGIN}/tasks/42`

// onCreated reports a not-yet-committed tab with an empty `url`.
const pendingTab = (overrides: Partial<chrome.tabs.Tab> = {}) =>
  makeTab({ id: 9, pendingUrl: TQ_URL, url: '', ...overrides })

describe('reuseExistingTqTab', () => {
  it('navigates the existing tq tab to the new URL, closes the new tab, and focuses the existing one', async () => {
    stubChrome([makeTab({ id: 1, windowId: 20, url: `${TQ_ORIGIN}/` })])

    expect(await run(pendingTab())).toEqual({
      error: null,
      calls: [
        ['tabs.update', 1, { url: TQ_URL, active: true }],
        ['tabs.remove', 9],
        ['windows.update', 20, { focused: true }],
      ],
    })
  })

  it('picks the most recently used tq tab, ignoring the new tab itself', async () => {
    stubChrome([
      makeTab({ id: 1, url: `${TQ_ORIGIN}/`, lastAccessed: 100 }),
      makeTab({
        id: 2,
        windowId: 20,
        url: `${TQ_ORIGIN}/projects`,
        lastAccessed: 300,
      }),
      makeTab({ id: 3, url: `${TQ_ORIGIN}/settings`, lastAccessed: 200 }),
      makeTab({ id: 9, url: TQ_URL, lastAccessed: 999 }),
    ])

    expect(await run(pendingTab())).toEqual({
      error: null,
      calls: [
        ['tabs.update', 2, { url: TQ_URL, active: true }],
        ['tabs.remove', 9],
        ['windows.update', 20, { focused: true }],
      ],
    })
  })

  it('reads the URL from url when pendingUrl is absent', async () => {
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })])

    expect(await run(makeTab({ id: 9, url: TQ_URL }))).toEqual({
      error: null,
      calls: [
        ['tabs.update', 1, { url: TQ_URL, active: true }],
        ['tabs.remove', 9],
        ['windows.update', 10, { focused: true }],
      ],
    })
  })

  it('reuses the existing tab when the new tab was opened from a non-tq tab', async () => {
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })])

    expect(await run(pendingTab({ openerTabId: 5 }))).toEqual({
      error: null,
      calls: [
        ['tabs.update', 1, { url: TQ_URL, active: true }],
        ['tabs.remove', 9],
        ['windows.update', 10, { focused: true }],
      ],
    })
  })

  it('does nothing when the new tab was opened from a tq tab', async () => {
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })])

    expect(await run(pendingTab({ openerTabId: 1 }))).toEqual({
      error: null,
      calls: [],
    })
  })

  it('does nothing when the new tab is the only tq tab', async () => {
    stubChrome([makeTab({ id: 9, url: TQ_URL })])

    expect(await run(pendingTab())).toEqual({ error: null, calls: [] })
  })

  it('does nothing when the new tab is not a tq URL', async () => {
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })])

    expect(
      await run(pendingTab({ pendingUrl: 'https://example.com/' })),
    ).toEqual({ error: null, calls: [] })
  })

  it('ignores a tab on the same host but a different port', async () => {
    stubChrome([makeTab({ id: 1, url: 'https://tq.example.test:8443/x' })])

    expect(await run(pendingTab())).toEqual({ error: null, calls: [] })
  })

  it('keeps the new tab open and errs when navigating the existing tab fails', async () => {
    const failure = new Error('no such tab')
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })], {
      'tabs.update': failure,
    })

    expect(await run(pendingTab())).toEqual({
      error: new Error('tq tab reuse failed', { cause: failure }),
      calls: [['tabs.update', 1, { url: TQ_URL, active: true }]],
    })
  })

  it('still closes the new tab and errs when focusing the window fails', async () => {
    const failure = new Error('no such window')
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })], {
      'windows.update': failure,
    })

    expect(await run(pendingTab())).toEqual({
      error: new Error('tq tab reuse failed', { cause: failure }),
      calls: [
        ['tabs.update', 1, { url: TQ_URL, active: true }],
        ['tabs.remove', 9],
        ['windows.update', 10, { focused: true }],
      ],
    })
  })
})
