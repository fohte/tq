import { okAsync, ResultAsync } from 'neverthrow'

import { TQ_ORIGIN } from '#config'

function wrap<T>(promise: Promise<T>): ResultAsync<T, Error> {
  return ResultAsync.fromPromise(
    promise,
    (cause) => new Error('tq link handoff failed', { cause }),
  )
}

function normalizedTqOrigin(): string {
  return TQ_ORIGIN.endsWith('/') ? TQ_ORIGIN.slice(0, -1) : TQ_ORIGIN
}

function isTqUrl(url: string | undefined): url is string {
  if (url === undefined) return false

  const origin = normalizedTqOrigin()
  return (
    url === origin ||
    url.startsWith(`${origin}/`) ||
    url.startsWith(`${origin}?`) ||
    url.startsWith(`${origin}#`)
  )
}

function toTqDeepLink(url: string): string | undefined {
  if (!isTqUrl(url)) return undefined
  return url.replace(/^https?:/, 'tq:')
}

function isEmptyTabUrl(url: string | undefined): boolean {
  return (
    url === undefined ||
    url === '' ||
    url === 'about:blank' ||
    url === 'chrome://newtab' ||
    url === 'chrome://newtab/' ||
    url === 'chrome://new-tab-page' ||
    url === 'chrome://new-tab-page/'
  )
}

export function openTqLinkInApp(
  details: chrome.webNavigation.WebNavigationBaseCallbackDetails,
): ResultAsync<void, Error> {
  if (details.frameId !== 0 || details.tabId < 0) return okAsync(undefined)

  const deepLink = toTqDeepLink(details.url)
  if (deepLink === undefined) return okAsync(undefined)

  return wrap(chrome.tabs.get(details.tabId)).andThen((tab) => {
    const closeTabAfterHandoff = isEmptyTabUrl(tab.url)
    if (isTqUrl(tab.url)) return okAsync(undefined)

    const openerTabResult: ResultAsync<chrome.tabs.Tab | undefined, Error> =
      closeTabAfterHandoff && tab.openerTabId !== undefined
        ? wrap<chrome.tabs.Tab | undefined>(chrome.tabs.get(tab.openerTabId))
        : okAsync<chrome.tabs.Tab | undefined>(undefined)

    return openerTabResult.andThen((openerTab) => {
      if (isTqUrl(openerTab?.url)) return okAsync(undefined)

      return wrap(chrome.tabs.update(details.tabId, { url: deepLink })).andThen(
        () =>
          closeTabAfterHandoff
            ? wrap(chrome.tabs.remove(details.tabId)).map(() => undefined)
            : okAsync(undefined),
      )
    })
  })
}
