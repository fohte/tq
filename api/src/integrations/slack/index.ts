import { errAsync, okAsync } from 'neverthrow'
import { z } from 'zod'

import { getOAuthEnvConfig } from '#integrations/env-config'
import { AccountIdentityError } from '#integrations/errors'
import type { ConnectionStatus, IntegrationProvider } from '#integrations/types'
import { fetchJson, TokenExchangeError } from '#lib/fetch-json'

const SLACK_AUTHORIZE_ENDPOINT = 'https://slack.com/oauth/v2_user/authorize'
const SLACK_TOKEN_ENDPOINT = 'https://slack.com/api/oauth.v2.user.access'
const SLACK_AUTH_TEST_ENDPOINT = 'https://slack.com/api/auth.test'
// Scopes needed to resolve a permalink (a later PR): message bodies
// (`*:history`), channel names (`channels:read`/`groups:read`), and author
// names (`users:read`). All are requested up front since adding a scope
// later would force every already-connected workspace to re-authorize.
const SCOPES = [
  'channels:history',
  'groups:history',
  'im:history',
  'mpim:history',
  'channels:read',
  'groups:read',
  'users:read',
].join(',')
const PROVIDER_ID = 'slack'

export class SlackApiError extends Error {
  constructor(message: string, cause?: unknown) {
    super(`Slack API error: ${message}`, { cause })
    this.name = 'SlackApiError'
  }
}

const tokenResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), access_token: z.string() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

const authTestResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), team: z.string(), team_id: z.string() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

// Slack error codes that mean the token itself is no longer valid, as
// opposed to a transient failure (rate limiting, a Slack-side outage) that
// must not be treated as a disconnect.
const INVALID_TOKEN_ERRORS = new Set([
  'invalid_auth',
  'token_revoked',
  'account_inactive',
  'token_expired',
])

export const slackProvider = {
  id: PROVIDER_ID,
  displayName: 'Slack',
  oauth: {
    authorizationEndpoint: SLACK_AUTHORIZE_ENDPOINT,
    scope: SCOPES,
    getConfig: () => getOAuthEnvConfig('SLACK'),
    exchangeCode: (code, config) =>
      fetchJson(
        SLACK_TOKEN_ENDPOINT,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        // Slack reports a rejected code with a 200 status and `ok: false`
        // rather than a non-2xx response, so this can't be caught by
        // fetchJson.
        if (!data.ok) {
          return errAsync(new TokenExchangeError(data.error, undefined, true))
        }

        return okAsync({ accessToken: data.access_token })
      }),
    identifyAccount: (accessToken) =>
      fetchJson(
        SLACK_AUTH_TEST_ENDPOINT,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        authTestResponseSchema,
        (message, cause) => new AccountIdentityError(message, cause),
      ).andThen((data) =>
        data.ok
          ? okAsync({ accountId: data.team_id, accountLabel: data.team })
          : errAsync(new AccountIdentityError(data.error)),
      ),
  },
  checkConnection: (token) =>
    fetchJson(
      SLACK_AUTH_TEST_ENDPOINT,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.accessToken}` },
      },
      authTestResponseSchema,
      (message, cause) => new SlackApiError(message, cause),
    ).andThen((data) => {
      if (data.ok) {
        return okAsync<ConnectionStatus, SlackApiError>({
          connected: true,
          login: data.team,
        })
      }

      // Only a known invalid-token error tells the common OAuth layer to
      // drop the stored token; anything else (rate limiting, a Slack-side
      // outage) must surface as a failure instead of silently disconnecting
      // a still-valid account.
      if (INVALID_TOKEN_ERRORS.has(data.error)) {
        return okAsync<ConnectionStatus, SlackApiError>({ connected: false })
      }

      return errAsync(new SlackApiError(data.error))
    }),
} satisfies IntegrationProvider
