import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq } from 'drizzle-orm'
import { errAsync, okAsync, type Result, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import {
  type AccountIdentityError,
  type IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import type {
  ConnectionStatus,
  IntegrationListItem,
  IntegrationProvider,
  OAuthTokenRow,
} from '#integrations/types'
import type { TokenExchangeError } from '#lib/fetch-json'

// Token refresh buffer: refresh 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000

export function getAuthUrl(
  provider: IntegrationProvider,
): Result<string, IntegrationConfigError> {
  return provider.oauth.getConfig().map((config) => {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: provider.oauth.scope,
      ...provider.oauth.extraAuthorizationParams,
    })

    return `${provider.oauth.authorizationEndpoint}?${params.toString()}`
  })
}

// GitHub has no IntegrationOAuth.identifyAccount, so its rows always use
// this sentinel (see oauthTokens.accountId in db/schema.ts).
const NO_ACCOUNT_IDENTITY_SENTINEL = ''

export function handleOAuthCallback(
  provider: IntegrationProvider,
  code: string,
): ResultAsync<
  void,
  IntegrationConfigError | TokenExchangeError | AccountIdentityError
> {
  return provider.oauth
    .getConfig()
    .asyncAndThen((config) => provider.oauth.exchangeCode(code, config))
    .andThen((payload) => {
      const identifyAccount = provider.oauth.identifyAccount
      const identity: ResultAsync<
        { accountId: string; accountLabel: string | null },
        AccountIdentityError
      > =
        identifyAccount != null
          ? identifyAccount(payload.accessToken)
          : okAsync({
              accountId: NO_ACCOUNT_IDENTITY_SENTINEL,
              accountLabel: null,
            })

      return identity.andThen(({ accountId, accountLabel }) =>
        ResultAsync.fromSafePromise(
          db
            .insert(oauthTokens)
            .values({
              provider: provider.id,
              accountId,
              accountLabel,
              accessToken: payload.accessToken,
              ...(payload.refreshToken != null
                ? { refreshToken: payload.refreshToken }
                : {}),
              ...(payload.expiresAt != null
                ? { expiresAt: payload.expiresAt }
                : {}),
            })
            .onConflictDoUpdate({
              target: [oauthTokens.provider, oauthTokens.accountId],
              set: {
                accountLabel,
                accessToken: payload.accessToken,
                updatedAt: new Date(),
                ...(payload.refreshToken != null
                  ? { refreshToken: payload.refreshToken }
                  : {}),
                ...(payload.expiresAt != null
                  ? { expiresAt: payload.expiresAt }
                  : {}),
              },
            }),
        ).map(() => undefined),
      )
    })
}

// Refreshes `token`'s access token if it's missing or close to expiry.
// Shared by `getValidAccessToken` (single account, looked up by accountId)
// and callers that already hold a token row for multiple accounts (e.g.
// google-calendar's multi-account getEvents).
export function ensureValidAccessToken(
  provider: IntegrationProvider,
  token: OAuthTokenRow,
): ResultAsync<string, IntegrationConfigError | TokenRefreshError> {
  const refresh = provider.oauth.refresh
  if (refresh == null) {
    return okAsync(token.accessToken)
  }

  const { refreshToken, expiresAt } = token
  if (refreshToken == null || expiresAt == null) {
    return errAsync(
      new TokenRefreshError(
        `${provider.displayName} OAuth token is missing refresh metadata`,
      ),
    )
  }

  if (expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
    return okAsync(token.accessToken)
  }

  return provider.oauth
    .getConfig()
    .asyncAndThen((config) => refresh(refreshToken, config))
    .andThen((payload) =>
      ResultAsync.fromSafePromise(
        db
          .update(oauthTokens)
          .set({
            accessToken: payload.accessToken,
            expiresAt: payload.expiresAt,
            updatedAt: new Date(),
            ...(payload.refreshToken != null && payload.refreshToken !== ''
              ? { refreshToken: payload.refreshToken }
              : {}),
          })
          .where(eq(oauthTokens.id, token.id)),
      ).map(() => payload.accessToken),
    )
}

// `accountId` defaults to the no-identity sentinel, matching every existing
// caller (GitHub, whose provider has no identifyAccount hook).
export function getValidAccessToken(
  provider: IntegrationProvider,
  accountId: string = NO_ACCOUNT_IDENTITY_SENTINEL,
): ResultAsync<
  string,
  OAuthTokenMissingError | IntegrationConfigError | TokenRefreshError
> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.provider, provider.id),
          eq(oauthTokens.accountId, accountId),
        ),
      )
      .limit(1),
  ).andThen(([token]) => {
    if (!token) {
      return errAsync(new OAuthTokenMissingError())
    }

    return ensureValidAccessToken(provider, token)
  })
}

// Lists every connected account's token row for `provider`. Never fails
// (a bare select), letting callers that fan out per account (e.g.
// google-calendar's multi-account getEvents) treat "no rows" the same as
// any other empty result instead of a distinct error case.
export function listAccountTokens(
  provider: IntegrationProvider,
): ResultAsync<OAuthTokenRow[], never> {
  return ResultAsync.fromSafePromise(
    db.select().from(oauthTokens).where(eq(oauthTokens.provider, provider.id)),
  )
}

export function getConnectionStatus(
  provider: IntegrationProvider,
): ResultAsync<ConnectionStatus, Error> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, provider.id))
      .limit(1),
  ).andThen(([token]) => {
    if (!token) {
      return okAsync<ConnectionStatus, Error>({ connected: false })
    }

    const checkConnection = provider.checkConnection
    if (checkConnection == null) {
      return okAsync<ConnectionStatus, Error>({ connected: true })
    }

    return checkConnection(token).andThen((status) =>
      status.connected
        ? okAsync<ConnectionStatus, Error>(status)
        : disconnect(provider).map((): ConnectionStatus => ({
            connected: false,
          })),
    )
  })
}

// Resolves to a best-effort summary rather than a Result: one provider's
// checkConnection failure (e.g. a GitHub API hiccup) must not take down the
// whole `GET /api/integrations` list, so the error is captured and degraded
// to `connected: false` here instead of propagating.
export async function getIntegrationSummary(
  provider: IntegrationProvider,
): Promise<IntegrationListItem> {
  const configured = provider.oauth.getConfig().match(
    () => true,
    () => false,
  )

  const status = await getConnectionStatus(provider).match(
    (status) => status,
    (error): ConnectionStatus => {
      captureWithFingerprint(error, 'api.integrations.get-summary-failed', {
        extras: { provider: provider.id },
      })
      return { connected: false }
    },
  )

  return {
    id: provider.id,
    displayName: provider.displayName,
    configured,
    ...status,
  }
}

// Deletes every account connected to this provider, not just one — for a
// provider with multiple connected accounts (e.g. google_calendar), this
// is a deliberate "disconnect everything" for now. Per-account disconnect
// is deferred to a follow-up PR alongside the accounts-list UI.
export function disconnect(
  provider: IntegrationProvider,
): ResultAsync<void, never> {
  return ResultAsync.fromSafePromise(
    db.delete(oauthTokens).where(eq(oauthTokens.provider, provider.id)),
  ).map(() => undefined)
}
