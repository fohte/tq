import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TQ_ORIGIN } from '#config'
import { reuseExistingTqTab } from '#tab-reuse'

function makeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    windowId: 10,
    index: 0,
    lastAccessed: 0,
    pinned: false,
    highlighted: false,
    active: false,
    frozen: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    ...overrides,
  }
}

// Records every mutating chrome call in order so a test can assert the whole
// sequence with one equality.
let calls: unknown[][]

function stubChrome(existingTabs: chrome.tabs.Tab[]): void {
  calls = []
  vi.stubGlobal('chrome', {
    tabs: {
      query: vi.fn().mockResolvedValue(existingTabs),
      update: vi.fn((...args: unknown[]) => {
        calls.push(['tabs.update', ...args])
        return Promise.resolve()
      }),
      remove: vi.fn((...args: unknown[]) => {
        calls.push(['tabs.remove', ...args])
        return Promise.resolve()
      }),
    },
    windows: {
      update: vi.fn((...args: unknown[]) => {
        calls.push(['windows.update', ...args])
        return Promise.resolve()
      }),
    },
  })
}

beforeEach(() => {
  calls = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const TQ_URL = `${TQ_ORIGIN}/tasks/42`

describe('reuseExistingTqTab', () => {
  it('navigates the most recently used other tq tab to the new URL, focuses it, and closes the new tab', async () => {
    stubChrome([
      makeTab({ id: 1, url: `${TQ_ORIGIN}/`, lastAccessed: 100 }),
      makeTab({
        id: 2,
        windowId: 20,
        url: `${TQ_ORIGIN}/projects`,
        lastAccessed: 300,
      }),
      makeTab({ id: 3, url: `${TQ_ORIGIN}/settings`, lastAccessed: 200 }),
      makeTab({ id: 9, pendingUrl: TQ_URL, url: '', lastAccessed: 999 }),
    ])

    const result = await reuseExistingTqTab(
      makeTab({ id: 9, pendingUrl: TQ_URL, url: '' }),
    )

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([
      ['tabs.update', 2, { url: TQ_URL, active: true }],
      ['windows.update', 20, { focused: true }],
      ['tabs.remove', 9],
    ])
  })

  it('does nothing when the new tab is the only tq tab', async () => {
    stubChrome([makeTab({ id: 9, pendingUrl: TQ_URL, url: '' })])

    const result = await reuseExistingTqTab(
      makeTab({ id: 9, pendingUrl: TQ_URL, url: '' }),
    )

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([])
  })

  it('does nothing when the new tab is not a tq URL', async () => {
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })])

    const result = await reuseExistingTqTab(
      makeTab({ id: 9, pendingUrl: 'https://example.com/', url: '' }),
    )

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([])
  })

  it('ignores a tab on the same host but a different origin', async () => {
    stubChrome([makeTab({ id: 1, url: 'http://other.example.test/x' })])

    const result = await reuseExistingTqTab(
      makeTab({ id: 9, pendingUrl: TQ_URL, url: '' }),
    )

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([])
  })

  it('reads the URL from url when pendingUrl is absent', async () => {
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })])

    await reuseExistingTqTab(makeTab({ id: 9, url: TQ_URL }))

    expect(calls).toEqual([
      ['tabs.update', 1, { url: TQ_URL, active: true }],
      ['windows.update', 10, { focused: true }],
      ['tabs.remove', 9],
    ])
  })

  it('keeps the new tab open and errs when navigating the existing tab fails', async () => {
    stubChrome([makeTab({ id: 1, url: `${TQ_ORIGIN}/` })])
    const failure = new Error('no such tab')
    vi.stubGlobal('chrome', {
      ...chrome,
      tabs: { ...chrome.tabs, update: vi.fn().mockRejectedValue(failure) },
    })

    const result = await reuseExistingTqTab(
      makeTab({ id: 9, pendingUrl: TQ_URL, url: '' }),
    )

    expect(result._unsafeUnwrapErr()).toEqual(
      new Error('tq tab reuse failed', { cause: failure }),
    )
    expect(calls).toEqual([])
  })
})
