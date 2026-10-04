import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import type {
  IntegrationAccount,
  IntegrationProvider,
  OAuthTokenRow,
} from '#integrations/types'

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
