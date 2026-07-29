import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { z } from 'zod'

import { getOAuthEnvConfig } from '#integrations/env-config'
import type { ConnectionStatus, IntegrationProvider } from '#integrations/types'
import { errorMessage, fetchJson, TokenExchangeError } from '#lib/fetch-json'

const GITHUB_AUTH_ENDPOINT = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token'
const GITHUB_API_BASE = 'https://api.github.com'
// `repo` is the narrowest OAuth App scope covering private repo issues/PRs;
// GitHub has no read-only equivalent for private repos
// (see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).
const SCOPES = 'repo'
const PROVIDER_ID = 'github'

export class GithubApiError extends Error {
  /**
   * True when GitHub responded with a 4xx (e.g. issue/PR not found or
   * inaccessible) — safe to relay to the client. False for a network/parse
   * failure or a 5xx, which must be reported to Sentry instead.
   */
  readonly rejected: boolean

  constructor(message: string, cause?: unknown, rejected = false) {
    super(`GitHub API error: ${message}`, { cause })
    this.name = 'GithubApiError'
    this.rejected = rejected
  }
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

export const githubProvider = {
  id: PROVIDER_ID,
  displayName: 'GitHub',
  oauth: {
    authorizationEndpoint: GITHUB_AUTH_ENDPOINT,
    scope: SCOPES,
    getConfig: () => getOAuthEnvConfig('GITHUB'),
    exchangeCode: (code, config) =>
      fetchJson(
        GITHUB_TOKEN_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
          }),
        },
        tokenResponseSchema,
        (message, cause, rejected) =>
          new TokenExchangeError(message, cause, rejected),
      ).andThen((data) => {
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

        return okAsync({ accessToken: data.access_token })
      }),
  },
  checkConnection: (token) =>
    ResultAsync.fromPromise(
      fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }),
      (cause) => new GithubApiError(errorMessage(cause), cause),
    ).andThen((response) => {
      if (response.status === 401) {
        // The token was revoked or expired on GitHub's side; reporting
        // `connected: false` tells the common OAuth layer to drop it.
        return okAsync<ConnectionStatus, GithubApiError>({ connected: false })
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
          ? okAsync<ConnectionStatus, GithubApiError>({
              connected: true,
              login: parsed.data.login,
            })
          : errAsync(new GithubApiError(parsed.error.message, parsed.error))
      })
    }),
} satisfies IntegrationProvider
