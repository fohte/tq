import { Result } from 'neverthrow'

export type NavigationAction =
  'allow' | 'open-main' | 'open-memo' | 'open-external' | 'deny'

export type NavigationSource = 'main' | 'side' | 'memo'

const parseUrl = Result.fromThrowable(
  (url: string) => new URL(url),
  (caughtErr) => caughtErr,
)

const resolveUrl = Result.fromThrowable(
  ({ path, base }: { path: string; base: string }) => new URL(path, base),
  (caughtErr) => caughtErr,
)

const originOf = (url: string): string | undefined =>
  parseUrl(url).match(
    (parsed) => parsed.origin,
    () => undefined,
  )

const pathOf = (url: string): string | undefined =>
  parseUrl(url).match(
    (parsed) => parsed.pathname,
    () => undefined,
  )

const isMemoPath = (url: string): boolean =>
  pathOf(url)?.replace(/\/+$/, '') === '/memo'

// Compare origins for equality, never by prefix: a prefix match lets
// `https://tq.example.com.evil.test` through. `origin` may carry a path or
// trailing slash; only its origin part counts.
export const isInternalUrl = (url: string, origin: string): boolean => {
  const urlOrigin = originOf(url)
  return urlOrigin !== undefined && urlOrigin === originOf(origin)
}

export const resolveInternalUrl = (
  path: string,
  origin: string,
): string | undefined =>
  resolveUrl({ path, base: origin }).match(
    (parsed) => (isInternalUrl(parsed.href, origin) ? parsed.href : undefined),
    () => undefined,
  )

export const resolveOpenInMainWindowPath = (
  path: unknown,
  senderUrl: string,
  origin: string,
): string | undefined => {
  if (typeof path !== 'string' || !isInternalUrl(senderUrl, origin)) {
    return undefined
  }

  const base = parseUrl(origin).match(
    (parsed) => `${parsed.origin}/`,
    () => undefined,
  )
  if (base === undefined) return undefined

  return resolveUrl({ path, base }).match(
    (parsed) => {
      if (!isInternalUrl(parsed.href, origin)) return undefined
      const pathname = `/${parsed.pathname.replace(/^\/+/, '')}`
      return `${pathname}${parsed.search}${parsed.hash}`
    },
    () => undefined,
  )
}

export const createOnNavigateRequest = (
  subscribe: (listener: (path: unknown) => void) => () => void,
  reportListenerState: (registered: boolean) => void,
): ((listener: (path: string) => void) => () => void) => {
  let listenerCount = 0

  return (listener) => {
    if (typeof listener !== 'function') return () => undefined

    const unsubscribe = subscribe((path) => {
      if (typeof path === 'string') listener(path)
    })
    listenerCount += 1
    if (listenerCount === 1) reportListenerState(true)

    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      unsubscribe()
      listenerCount -= 1
      if (listenerCount === 0) reportListenerState(false)
    }
  }
}

export const shouldUseNavigationRequest = (
  listenerRegistered: boolean,
  mainWindowUrl: string,
  origin: string,
  mainWindowLoading: boolean,
): boolean =>
  !mainWindowLoading &&
  listenerRegistered &&
  isInternalUrl(mainWindowUrl, origin)

export const OPEN_IN_MAIN_WINDOW_CHANNEL = 'tq:open-in-main-window'
export const NAVIGATION_REQUEST_CHANNEL = 'tq:navigation-request'
export const NAVIGATION_LISTENER_STATE_CHANNEL = 'tq:navigation-listener-state'

export const shouldOpenSideNavigationInMain = (
  targetUrl: string,
  sideWindowUrl: string,
  origin: string,
): boolean => {
  if (!isInternalUrl(targetUrl, origin)) return false

  const targetPath = pathOf(targetUrl)
  const sideWindowPath = pathOf(sideWindowUrl)
  return (
    targetPath !== undefined &&
    sideWindowPath !== undefined &&
    targetPath !== sideWindowPath
  )
}

// Keep in sync with `mac.protocols.schemes` in electron-builder.yml.
export const DEEP_LINK_SCHEME = 'tq'

const DEEP_LINK_PROTOCOL = `${DEEP_LINK_SCHEME}:`

// Turns `tq://<host>/<path>` into the `TQ_ORIGIN` URL with the same host and
// path, or `undefined` when it is not a tq deep link for `origin`. Any site can
// link to `tq://`, so a link for another host must never reach `loadURL`.
export const resolveDeepLink = (
  deepLink: string,
  origin: string,
): string | undefined => {
  const originProtocol = parseUrl(origin).match(
    (parsed) => parsed.protocol,
    () => undefined,
  )
  if (originProtocol === undefined) return undefined

  return parseUrl(deepLink).match(
    (parsed) => {
      if (parsed.protocol !== DEEP_LINK_PROTOCOL) return undefined
      const target = `${originProtocol}${parsed.href.slice(DEEP_LINK_PROTOCOL.length)}`
      // Reparse as http(s), unlike the opaque host of `tq:`, to lowercase it.
      return parseUrl(target).match(
        (url) => (isInternalUrl(url.href, origin) ? url.href : undefined),
        () => undefined,
      )
    },
    () => undefined,
  )
}

const DEFAULT_EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:']

const isOpenableExternally = (
  url: string,
  externalSchemes: readonly string[],
): boolean =>
  parseUrl(url).match(
    (parsed) =>
      DEFAULT_EXTERNAL_PROTOCOLS.includes(parsed.protocol) ||
      externalSchemes.some((scheme) => `${scheme}:` === parsed.protocol),
    () => false,
  )

// Decides what to do when the page at `currentUrl` navigates to, or opens a
// window for, `targetUrl`.
export const classifyNavigation = (
  currentUrl: string,
  targetUrl: string,
  origin: string,
  externalSchemes: readonly string[] = [],
  source: NavigationSource = 'main',
): NavigationAction => {
  // Leave pages outside tq (e.g. the Cloudflare Access / IdP login) alone;
  // otherwise the first sign-in can never complete inside the app.
  if (!isInternalUrl(currentUrl, origin)) return 'allow'
  if (isInternalUrl(targetUrl, origin) && isMemoPath(targetUrl)) {
    return 'open-memo'
  }
  if (
    (source === 'side' || source === 'memo') &&
    isInternalUrl(targetUrl, origin)
  ) {
    return 'open-main'
  }
  if (isInternalUrl(targetUrl, origin)) return 'allow'
  // `shell.openExternal` launches whatever handler is registered for the
  // scheme, so only hand it schemes known to be safe to open.
  return isOpenableExternally(targetUrl, externalSchemes)
    ? 'open-external'
    : 'deny'
}
