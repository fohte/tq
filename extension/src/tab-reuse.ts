import { okAsync, ResultAsync } from 'neverthrow'

import { TQ_ORIGIN } from '#config'

function wrap<T>(promise: Promise<T>): ResultAsync<T, Error> {
  return ResultAsync.fromPromise(
    promise,
    (cause) => new Error('tq tab reuse failed', { cause }),
  )
}

function isTqUrl(url: string | undefined): url is string {
  return url?.startsWith(`${TQ_ORIGIN}/`) ?? false
}

// Moves a freshly opened tq tab's URL into the most recently used other tq
// tab, focuses that tab, and closes the new one. Does nothing when no other tq
// tab exists.
export function reuseExistingTqTab(
  newTab: chrome.tabs.Tab,
): ResultAsync<void, Error> {
  // `url` is still empty when onCreated fires; the destination is in `pendingUrl`.
  const url = newTab.pendingUrl ?? newTab.url
  if (newTab.id === undefined || !isTqUrl(url)) {
    return okAsync(undefined)
  }
  const newTabId = newTab.id

  return wrap(chrome.tabs.query({ url: `${TQ_ORIGIN}/*` })).andThen((tabs) => {
    // The match pattern ignores ports, so re-check the origin exactly.
    const tqTabs = tabs.filter((tab) => tab.id !== newTabId && isTqUrl(tab.url))
    // Cmd/Ctrl-clicking a link inside tq is a deliberate request for a second
    // tab, so only tabs opened from outside tq are folded into an existing one.
    if (
      newTab.openerTabId !== undefined &&
      tqTabs.some((tab) => tab.id === newTab.openerTabId)
    ) {
      return okAsync(undefined)
    }
    const [existing] = tqTabs.sort((a, b) => b.lastAccessed - a.lastAccessed)
    if (existing?.id === undefined) return okAsync(undefined)

    const { id, windowId } = existing
    // Focusing comes last so a failure there cannot leave the new tab open
    // next to an already-navigated existing tab.
    return wrap(chrome.tabs.update(id, { url, active: true }))
      .andThen(() => wrap(chrome.tabs.remove(newTabId)))
      .andThen(() => wrap(chrome.windows.update(windowId, { focused: true })))
      .map(() => undefined)
  })
}
