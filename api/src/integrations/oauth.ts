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

// Lists every currently connected account for `provider`. For a provider
// with `checkConnection`, each stored row is live-checked individually and
// dropped (via disconnectAccount, scoped to that one row) if it fails — a
// revoked/expired account must not sweep up its sibling accounts' still-
// valid rows.
export function listConnectedAccounts(
  provider: IntegrationProvider,
): ResultAsync<IntegrationAccount[], Error> {
  return listAccountTokens(provider).andThen((tokens) => {
    const checkConnection = provider.checkConnection
    if (checkConnection == null) {
      return okAsync<IntegrationAccount[], Error>(
        tokens.map((token) => ({ id: token.id, label: token.accountLabel })),
      )
    }

    return ResultAsync.combine(
      tokens.map((token) =>
        checkConnection(token)
          .andThen((status) =>
            status.connected
              ? okAsync<IntegrationAccount | null, Error>({
                  id: token.id,
                  label: status.login ?? token.accountLabel,
                })
              : disconnectAccount(provider, token.id).map(() => null),
          )
          // A checkConnection failure for one account (e.g. a transient API
          // error) must not discard every sibling account's result via
          // ResultAsync.combine's short-circuit-on-first-Err. Treat it as
          // "unknown for now" — excluded from this response, row left
          // untouched — rather than a definitive `connected: false`, which
          // is the only case that should actually delete the row.
          .orElse((error) => {
            captureWithFingerprint(
              error,
              'api.integrations.check-connection-failed',
              { extras: { provider: provider.id } },
            )
            return okAsync<IntegrationAccount | null, Error>(null)
          }),
      ),
    ).map((accounts) =>
      accounts.filter(
        (account): account is IntegrationAccount => account != null,
      ),
    )
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

// Deletes a single account row scoped to `provider`. `accountRowId` is
// oauthTokens.id (a surrogate key), not the provider-specific accountId —
// see IntegrationAccount.id in integrations/types.ts. Resolves to whether a
// row was actually deleted, so callers can tell "already gone"/"wrong
// provider" apart from success.
export function disconnectAccount(
  provider: IntegrationProvider,
  accountRowId: string,
): ResultAsync<boolean, never> {
  return ResultAsync.fromSafePromise(
    db
      .delete(oauthTokens)
      .where(
        and(
          eq(oauthTokens.provider, provider.id),
          eq(oauthTokens.id, accountRowId),
        ),
      )
      .returning({ id: oauthTokens.id }),
  ).map((rows) => rows.length > 0)
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
