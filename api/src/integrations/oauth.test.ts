import { eq } from 'drizzle-orm'
import { errAsync, ok, okAsync, type ResultAsync } from 'neverthrow'
import { describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import { disconnectAccount, listConnectedAccounts } from '#integrations/oauth'
import type {
  ConnectionStatus,
  IntegrationProvider,
  OAuthTokenRow,
} from '#integrations/types'
import { TokenExchangeError } from '#lib/fetch-json'
import { assertDefined, setupTestDb } from '#testing'

setupTestDb()

// Neither real provider combines "supports multiple accounts" with "has a
// live checkConnection" (only GitHub has checkConnection, and GitHub is
// single-account), so this fake provider exercises listConnectedAccounts'
// per-row checkConnection fan-out that no real provider test can cover.
const FAKE_PROVIDER_ID = 'fake-multi'

function createFakeProvider(
  checkConnection?: IntegrationProvider['checkConnection'],
  id: string = FAKE_PROVIDER_ID,
): IntegrationProvider {
  return {
    id,
    displayName: 'Fake Multi',
    oauth: {
      authorizationEndpoint: 'https://example.com/authorize',
      scope: 'fake-scope',
      getConfig: () =>
        ok({
          clientId: 'fake-client-id',
          clientSecret: 'fake-client-secret',
          redirectUri: 'https://example.com/callback',
        }),
      exchangeCode: () => errAsync(new TokenExchangeError('not implemented')),
      identifyAccount: () =>
        okAsync({ accountId: 'unused', accountLabel: 'unused' }),
    },
    // exactOptionalPropertyTypes forbids assigning `undefined` to an
    // optional property, so the key is omitted entirely when unset.
    ...(checkConnection != null ? { checkConnection } : {}),
  }
}

// The `oauth_tokens_refresh_metadata_required` check requires non-null
// refreshToken/expiresAt for every provider id other than 'github'.
async function insertFakeToken(values: {
  accountId: string
  accessToken: string
}) {
  const [token] = await db
    .insert(oauthTokens)
    .values({
      provider: FAKE_PROVIDER_ID,
      accountLabel: null,
      refreshToken: 'fake-refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ...values,
    })
    .returning()
  assertDefined(token)
  return token
}

describe('listConnectedAccounts', () => {
  it('drops only the account that fails checkConnection, keeping its sibling intact', async () => {
    const surviving = await insertFakeToken({
      accountId: 'account-ok',
      accessToken: 'access-token-ok',
    })
    await insertFakeToken({
      accountId: 'account-bad',
      accessToken: 'access-token-bad',
    })

    const checkConnection = vi.fn(
      (token: OAuthTokenRow): ResultAsync<ConnectionStatus, Error> =>
        token.accessToken === 'access-token-ok'
          ? okAsync({ connected: true })
          : okAsync({ connected: false }),
    )
    const provider = createFakeProvider(checkConnection)

    const accounts = (await listConnectedAccounts(provider))._unsafeUnwrap()
    expect(accounts).toEqual([{ id: surviving.id, label: null }])

    const remaining = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, FAKE_PROVIDER_ID))
    expect(remaining).toEqual([surviving])
  })

  it('excludes an account whose checkConnection call errors, without deleting it or discarding its sibling', async () => {
    const errored = await insertFakeToken({
      accountId: 'account-erroring',
      accessToken: 'access-token-erroring',
    })
    const surviving = await insertFakeToken({
      accountId: 'account-ok',
      accessToken: 'access-token-ok',
    })

    const checkConnection = vi.fn(
      (token: OAuthTokenRow): ResultAsync<ConnectionStatus, Error> =>
        token.accessToken === 'access-token-ok'
          ? okAsync({ connected: true })
          : errAsync(new Error('transient check-connection failure')),
    )
    const provider = createFakeProvider(checkConnection)

    const accounts = (await listConnectedAccounts(provider))._unsafeUnwrap()
    expect(accounts).toEqual([{ id: surviving.id, label: null }])

    // Only a definitive `connected: false` should delete a row — an
    // unexpected checkConnection failure must leave it untouched.
    const remaining = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, FAKE_PROVIDER_ID))
    expect(
      remaining.sort((a, b) => a.accountId.localeCompare(b.accountId)),
    ).toEqual(
      [errored, surviving].sort((a, b) =>
        a.accountId.localeCompare(b.accountId),
      ),
    )
  })
})

describe('disconnectAccount', () => {
  it('deletes only the targeted row, leaving its sibling intact', async () => {
    const target = await insertFakeToken({
      accountId: 'account-1',
      accessToken: 'access-token-1',
    })
    const sibling = await insertFakeToken({
      accountId: 'account-2',
      accessToken: 'access-token-2',
    })

    const provider = createFakeProvider()

    expect((await disconnectAccount(provider, target.id))._unsafeUnwrap()).toBe(
      true,
    )

    const remaining = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, FAKE_PROVIDER_ID))
    expect(remaining).toEqual([sibling])
  })

  it('resolves to false and deletes nothing for a nonexistent row id', async () => {
    const existing = await insertFakeToken({
      accountId: 'account-1',
      accessToken: 'access-token-1',
    })

    const provider = createFakeProvider()

    expect(
      (await disconnectAccount(provider, 'nonexistent-id'))._unsafeUnwrap(),
    ).toBe(false)

    const remaining = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, FAKE_PROVIDER_ID))
    expect(remaining).toEqual([existing])
  })

  it('resolves to false and deletes nothing when the row belongs to a different provider', async () => {
    const target = await insertFakeToken({
      accountId: 'account-1',
      accessToken: 'access-token-1',
    })

    const otherProvider = createFakeProvider(undefined, 'fake-multi-other')

    expect(
      (await disconnectAccount(otherProvider, target.id))._unsafeUnwrap(),
    ).toBe(false)

    const remaining = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, FAKE_PROVIDER_ID))
    expect(remaining).toEqual([target])
  })
})
