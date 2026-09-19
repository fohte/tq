import { Result } from 'neverthrow'

export type NavigationAction = 'allow' | 'open-external' | 'deny'

const parseUrl = Result.fromThrowable(
  (url: string) => new URL(url),
  (caughtErr) => caughtErr,
)

const originOf = (url: string): string | undefined =>
  parseUrl(url).match(
    (parsed) => parsed.origin,
    () => undefined,
  )

// Compare origins for equality, never by prefix: a prefix match lets
// `https://tq.example.com.evil.test` through. `origin` may carry a path or
// trailing slash; only its origin part counts.
const isInternal = (url: string, origin: string): boolean => {
  const urlOrigin = originOf(url)
  return urlOrigin !== undefined && urlOrigin === originOf(origin)
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
        (url) => (isInternal(url.href, origin) ? url.href : undefined),
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
): NavigationAction => {
  // Leave pages outside tq (e.g. the Cloudflare Access / IdP login) alone;
  // otherwise the first sign-in can never complete inside the app.
  if (!isInternal(currentUrl, origin)) return 'allow'
  if (isInternal(targetUrl, origin)) return 'allow'
  // `shell.openExternal` launches whatever handler is registered for the
  // scheme, so only hand it schemes known to be safe to open.
  return isOpenableExternally(targetUrl, externalSchemes)
    ? 'open-external'
    : 'deny'
}
