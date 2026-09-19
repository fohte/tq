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

const isWebUrl = (url: string): boolean =>
  parseUrl(url).match(
    (parsed) => parsed.protocol === 'http:' || parsed.protocol === 'https:',
    () => false,
  )

// Decides what to do when the page at `currentUrl` navigates to, or opens a
// window for, `targetUrl`.
export const classifyNavigation = (
  currentUrl: string,
  targetUrl: string,
  origin: string,
): NavigationAction => {
  // Leave pages outside tq (e.g. the Cloudflare Access / IdP login) alone;
  // otherwise the first sign-in can never complete inside the app.
  if (!isInternal(currentUrl, origin)) return 'allow'
  if (isInternal(targetUrl, origin)) return 'allow'
  // `shell.openExternal` launches whatever handler is registered for the
  // scheme, so only hand web URLs to it.
  return isWebUrl(targetUrl) ? 'open-external' : 'deny'
}
