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
import { listConnectedAccounts } from '#integrations/oauth-accounts'
import type {
  IntegrationAccount,
  IntegrationListItem,
  IntegrationProvider,
  OAuthTokenRow,
} from '#integrations/types'
import { firstOrErr, type RowNotFoundError } from '#lib/drizzle-utils'
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

export interface OAuthCallbackResult {
  oauthTokenId: string
  accountLabel: string | null
}

export function handleOAuthCallback(
  provider: IntegrationProvider,
  code: string,
): ResultAsync<
  OAuthCallbackResult,
  | IntegrationConfigError
  | TokenExchangeError
  | AccountIdentityError
  | RowNotFoundError
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
            })
            .returning({ id: oauthTokens.id }),
        ).andThen((rows) =>
          firstOrErr(rows).map((row) => ({
            oauthTokenId: row.id,
            accountLabel,
          })),
        ),
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

// Resolves to a best-effort summary rather than a Result: one provider's
// checkConnection failure (e.g. a GitHub API hiccup) must not take down the
// whole `GET /api/integrations` list, so the error is captured and degraded
// to an empty accounts list here instead of propagating.
export async function getIntegrationSummary(
  provider: IntegrationProvider,
): Promise<IntegrationListItem> {
  const configured = provider.oauth.getConfig().match(
    () => true,
    () => false,
  )

  const accounts = await listConnectedAccounts(provider).match(
    (accounts) => accounts,
    (error): IntegrationAccount[] => {
      captureWithFingerprint(error, 'api.integrations.get-summary-failed', {
        extras: { provider: provider.id },
      })
      return []
    },
  )

  return {
    id: provider.id,
    displayName: provider.displayName,
    configured,
    supportsMultipleAccounts: provider.oauth.identifyAccount != null,
    accounts,
  }
}

// Looks up a single account row scoped to `provider`, by the same
// `accountRowId` (oauthTokens.id) that disconnectAccount takes. Resolves to
// null both when the row doesn't exist and when it belongs to a different
// provider, so callers can't accidentally act on another provider's account
// through this id (see the IDOR-shaped 404 tests on
// DELETE /api/integrations/:id/accounts/:accountId for the same concern).
export function getAccountToken(
  provider: IntegrationProvider,
  accountRowId: string,
): ResultAsync<OAuthTokenRow | null, never> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.provider, provider.id),
          eq(oauthTokens.id, accountRowId),
        ),
      )
      .limit(1),
  ).map((rows) => rows[0] ?? null)
}
