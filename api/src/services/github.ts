import { db } from '@api/db/connection'
import { oauthTokens } from '@api/db/schema'
import { eq } from 'drizzle-orm'
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  ResultAsync,
} from 'neverthrow'
import { z } from 'zod'

const GITHUB_AUTH_ENDPOINT = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token'
const GITHUB_API_BASE = 'https://api.github.com'
// `repo` is the narrowest OAuth App scope covering private repo issues/PRs;
// GitHub has no read-only equivalent for private repos
// (see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).
const SCOPES = 'repo'
const PROVIDER = 'github'

export class GithubConfigError extends Error {
  constructor() {
    super(
      'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI environment variables are required',
    )
    this.name = 'GithubConfigError'
  }
}

export class TokenExchangeError extends Error {
  /**
   * True when GitHub itself rejected the authorization code (a normal
   * OAuth-flow outcome whose message is safe to relay to the client).
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

export class GithubApiError extends Error {
  constructor(message: string, cause?: unknown) {
    super(`GitHub API error: ${message}`, { cause })
    this.name = 'GithubApiError'
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const tokenResponseSchema = z.union([
  z.object({
    access_token: z.string(),
    token_type: z.string(),
    scope: z.string(),
  }),
  z.object({
    error: z.string(),
    error_description: z.string().optional(),
  }),
])

const githubUserSchema = z.object({
  login: z.string(),
})

interface GithubConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

function getConfig(): Result<GithubConfig, GithubConfigError> {
  const clientId = process.env['GITHUB_CLIENT_ID']
  const clientSecret = process.env['GITHUB_CLIENT_SECRET']
  const redirectUri = process.env['GITHUB_REDIRECT_URI']

  if (
    clientId == null ||
    clientId === '' ||
    clientSecret == null ||
    clientSecret === '' ||
    redirectUri == null ||
    redirectUri === ''
  ) {
    return err(new GithubConfigError())
  }

  return ok({ clientId, clientSecret, redirectUri })
}

export function getAuthUrl(): Result<string, GithubConfigError> {
  return getConfig().map(({ clientId, redirectUri }) => {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
    })

    return `${GITHUB_AUTH_ENDPOINT}?${params.toString()}`
  })
}

/**
 * Fetch `input` and parse the JSON response against `schema`, wrapping any
 * fetch failure, non-2xx response, or schema mismatch with `wrapError`.
 */
function fetchJson<T, E extends Error>(
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
      // provider-side failure, not a rejection.
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

export function handleOAuthCallback(
  code: string,
): ResultAsync<void, GithubConfigError | TokenExchangeError> {
  return getConfig()
    .asyncAndThen(({ clientId, clientSecret, redirectUri }) =>
      fetchJson(
        GITHUB_TOKEN_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        },
        tokenResponseSchema,
        (message, cause, rejected) =>
          new TokenExchangeError(message, cause, rejected),
      ),
    )
    .andThen((data) => {
      // GitHub reports a rejected code with a 200 status and an error body
      // rather than a non-2xx response, so this can't be caught by fetchJson.
      if ('error' in data) {
        return errAsync(
          new TokenExchangeError(
            data.error_description ?? data.error,
            undefined,
            true,
          ),
        )
      }

      return ResultAsync.fromSafePromise(
        db
          .insert(oauthTokens)
          .values({
            provider: PROVIDER,
            accessToken: data.access_token,
          })
          .onConflictDoUpdate({
            target: oauthTokens.provider,
            set: {
              accessToken: data.access_token,
              updatedAt: new Date(),
            },
          }),
      ).map(() => undefined)
    })
}

export type GithubConnectionStatus =
  { connected: false } | { connected: true; login: string }

export function getConnectionStatus(): ResultAsync<
  GithubConnectionStatus,
  GithubApiError
> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, PROVIDER))
      .limit(1),
  ).andThen(([token]) => {
    if (!token) {
      return okAsync<GithubConnectionStatus, GithubApiError>({
        connected: false,
      })
    }

    return ResultAsync.fromPromise(
      fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }),
      (cause) => new GithubApiError(errorMessage(cause), cause),
    ).andThen((response) => {
      if (response.status === 401) {
        // The token was revoked or expired on GitHub's side. Drop it so the
        // frontend can offer reconnecting instead of getting stuck on an
        // unrecoverable "connected" state.
        return disconnect().map((): GithubConnectionStatus => ({
          connected: false,
        }))
      }

      if (!response.ok) {
        return ResultAsync.fromPromise(
          response.text(),
          (cause) => new GithubApiError(errorMessage(cause), cause),
        ).andThen((text) => errAsync(new GithubApiError(text)))
      }

      return ResultAsync.fromPromise(
        response.json(),
        (cause) => new GithubApiError(errorMessage(cause), cause),
      ).andThen((json) => {
        const parsed = githubUserSchema.safeParse(json)
        return parsed.success
          ? okAsync<GithubConnectionStatus, GithubApiError>({
              connected: true,
              login: parsed.data.login,
            })
          : errAsync(new GithubApiError(parsed.error.message, parsed.error))
      })
    })
  })
}

export function disconnect(): ResultAsync<void, never> {
  return ResultAsync.fromSafePromise(
    db.delete(oauthTokens).where(eq(oauthTokens.provider, PROVIDER)),
  ).map(() => undefined)
}
