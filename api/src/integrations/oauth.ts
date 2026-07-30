import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'
import { errAsync, okAsync, type Result, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import {
  type IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import type {
  ConnectionStatus,
  IntegrationListItem,
  IntegrationProvider,
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

export function handleOAuthCallback(
  provider: IntegrationProvider,
  code: string,
): ResultAsync<void, IntegrationConfigError | TokenExchangeError> {
  return provider.oauth
    .getConfig()
    .asyncAndThen((config) => provider.oauth.exchangeCode(code, config))
    .andThen((payload) =>
      ResultAsync.fromSafePromise(
        db
          .insert(oauthTokens)
          .values({
            provider: provider.id,
            accessToken: payload.accessToken,
            ...(payload.refreshToken != null
              ? { refreshToken: payload.refreshToken }
              : {}),
            ...(payload.expiresAt != null
              ? { expiresAt: payload.expiresAt }
              : {}),
          })
          .onConflictDoUpdate({
            target: oauthTokens.provider,
            set: {
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
}

export function getValidAccessToken(
  provider: IntegrationProvider,
): ResultAsync<
  string,
  OAuthTokenMissingError | IntegrationConfigError | TokenRefreshError
> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, provider.id))
      .limit(1),
  ).andThen(([token]) => {
    if (!token) {
      return errAsync(new OAuthTokenMissingError())
    }

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
  })
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

export function disconnect(
  provider: IntegrationProvider,
): ResultAsync<void, never> {
  return ResultAsync.fromSafePromise(
    db.delete(oauthTokens).where(eq(oauthTokens.provider, provider.id)),
  ).map(() => undefined)
}
