import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { z } from 'zod'

export class TokenExchangeError extends Error {
  /**
   * True when the OAuth provider itself rejected the authorization code (a
   * normal OAuth-flow outcome whose message is safe to relay to the client).
   * False for a network/parse/schema failure, which must be reported to
   * Sentry instead of relayed.
   */
  readonly rejected: boolean

  constructor(message: string, cause?: unknown, rejected = false) {
    super(`Token exchange failed: ${message}`, { cause })
    this.name = 'TokenExchangeError'
    this.rejected = rejected
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Fetch `input` and parse the JSON response against `schema`, wrapping any
 * fetch failure, non-2xx response, or schema mismatch with `wrapError`.
 */
export function fetchJson<T, E extends Error>(
  input: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  wrapError: (message: string, cause?: unknown, rejected?: boolean) => E,
): ResultAsync<T, E> {
  return ResultAsync.fromPromise(fetch(input, init), (cause) =>
    wrapError(errorMessage(cause), cause),
  ).andThen((res) => {
    if (!res.ok) {
      // Only a 4xx counts as the provider rejecting the request; a 5xx is a
      // provider-side failure, not a rejection. Both TokenExchangeError and
      // TokenRefreshError branch on `rejected` to decide 401/400 vs 500.
      const rejected = res.status >= 400 && res.status < 500
      return ResultAsync.fromPromise(res.text(), (cause) =>
        wrapError(errorMessage(cause), cause),
      ).andThen((text) => errAsync(wrapError(text, undefined, rejected)))
    }
    return ResultAsync.fromPromise(res.json(), (cause) =>
      wrapError(errorMessage(cause), cause),
    ).andThen((data) => {
      const parsed = schema.safeParse(data)
      return parsed.success
        ? okAsync(parsed.data)
        : errAsync(wrapError(parsed.error.message, parsed.error))
    })
  })
}

export type ConditionalFetchResult<T> =
  { notModified: true } | { notModified: false; data: T; etag: string | null }

/**
 * Like `fetchJson`, but for a conditional GET: pass an `If-None-Match`
 * header in `init` to have the caller distinguish a 304 (nothing changed)
 * from a 200 (fresh `data`), instead of `fetchJson`'s single success shape.
 */
export function fetchJsonConditional<T, E extends Error>(
  input: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  wrapError: (message: string, cause?: unknown, rejected?: boolean) => E,
): ResultAsync<ConditionalFetchResult<T>, E> {
  return ResultAsync.fromPromise(fetch(input, init), (cause) =>
    wrapError(errorMessage(cause), cause),
  ).andThen((res) => {
    if (res.status === 304) {
      return okAsync<ConditionalFetchResult<T>, E>({ notModified: true })
    }
    if (!res.ok) {
      const rejected = res.status >= 400 && res.status < 500
      return ResultAsync.fromPromise(res.text(), (cause) =>
        wrapError(errorMessage(cause), cause),
      ).andThen((text) => errAsync(wrapError(text, undefined, rejected)))
    }
    return ResultAsync.fromPromise(res.json(), (cause) =>
      wrapError(errorMessage(cause), cause),
    ).andThen((data) => {
      const parsed = schema.safeParse(data)
      return parsed.success
        ? okAsync<ConditionalFetchResult<T>, E>({
            notModified: false,
            data: parsed.data,
            etag: res.headers.get('etag'),
          })
        : errAsync(wrapError(parsed.error.message, parsed.error))
    })
  })
}
