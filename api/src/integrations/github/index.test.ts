import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import { IntegrationConfigError } from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import { googleCalendarProvider } from '#integrations/google-calendar/index'
import {
  disconnectAccount,
  getAuthUrl,
  getIntegrationSummary,
  handleOAuthCallback,
  listConnectedAccounts,
} from '#integrations/oauth'
import { TokenExchangeError } from '#lib/fetch-json'
import { assertDefined, setupTestDb } from '#testing'

setupTestDb()

const MOCK_ENV = {
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_REDIRECT_URI: 'http://localhost:3001/api/github/oauth-callback',
}

function setEnv() {
  for (const [key, value] of Object.entries(MOCK_ENV)) {
    process.env[key] = value
  }
}

function clearEnv() {
  for (const key of Object.keys(MOCK_ENV)) {
    Reflect.deleteProperty(process.env, key)
  }
}

async function upsertToken(accessToken: string) {
  const [token] = await db
    .insert(oauthTokens)
    .values({ provider: 'github', accountId: '', accessToken })
    .onConflictDoUpdate({
      target: [oauthTokens.provider, oauthTokens.accountId],
      set: { accessToken, updatedAt: new Date() },
    })
    .returning()
  assertDefined(token)
  return token
}

beforeEach(() => {
  setEnv()
})

afterEach(() => {
  clearEnv()
  vi.restoreAllMocks()
})

function normalize(token: typeof oauthTokens.$inferSelect) {
  return {
    ...token,
    id: 'ID',
    createdAt: 'DATE',
    updatedAt: 'DATE',
  }
}

// Replaces the surrogate row id with a fixed placeholder, same idea as
// normalize() above, so an IntegrationAccount[] can still be asserted with a
// single toEqual.
function normalizeAccounts(accounts: { id: string; label: string | null }[]) {
  return accounts.map((account) => ({ ...account, id: 'ID' }))
}

function normalizeSummary(
  summary: Awaited<ReturnType<typeof getIntegrationSummary>>,
) {
  return { ...summary, accounts: normalizeAccounts(summary.accounts) }
}

describe('getAuthUrl', () => {
  it('returns a GitHub OAuth authorization URL with correct parameters', () => {
    const url = getAuthUrl(githubProvider)._unsafeUnwrap()
    const parsed = new URL(url)

    expect(parsed.origin + parsed.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    )
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3001/api/github/oauth-callback',
    )
    expect(parsed.searchParams.get('scope')).toBe('repo')
  })

  it('returns a config error when environment variables are missing', () => {
    clearEnv()

    const error = getAuthUrl(githubProvider)._unsafeUnwrapErr()

    expect(error).toEqual(
      new IntegrationConfigError(
        'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI environment variables are required',
      ),
    )
  })
})

describe('handleOAuthCallback', () => {
  it('exchanges code for a token and saves it to the database', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          token_type: 'bearer',
          scope: 'repo',
        }),
        { status: 200 },
      ),
    )

    ;(
      await handleOAuthCallback(githubProvider, 'auth-code-123')
    )._unsafeUnwrap()

    const [savedToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    assertDefined(savedToken)

    expect(normalize(savedToken)).toEqual({
      id: 'ID',
      provider: 'github',
      accountId: '',
      accountLabel: null,
      accessToken: 'new-access-token',
      refreshToken: null,
      expiresAt: null,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns a token exchange error when the token endpoint returns a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    const error = (
      await handleOAuthCallback(githubProvider, 'bad-code')
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenExchangeError('server error'))
  })

  it('returns a rejected token exchange error when GitHub returns an error payload with 200 status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        }),
        { status: 200 },
      ),
    )

    const error = (
      await handleOAuthCallback(githubProvider, 'bad-code')
    )._unsafeUnwrapErr()

    expect(error).toEqual(
      new TokenExchangeError(
        'The code passed is incorrect or expired.',
        undefined,
        true,
      ),
    )
  })
})

describe('listConnectedAccounts', () => {
  it('returns no accounts when no token exists', async () => {
    expect(
      (await listConnectedAccounts(githubProvider))._unsafeUnwrap(),
    ).toEqual([])
  })

  it('returns the account with its live-checked login when a token exists', async () => {
    await upsertToken('valid-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ login: 'fohte' }), { status: 200 }),
    )

    const accounts = (
      await listConnectedAccounts(githubProvider)
    )._unsafeUnwrap()

    expect(normalizeAccounts(accounts)).toEqual([{ id: 'ID', label: 'fohte' }])
  })

  it('returns a GitHub API error when the request fails', async () => {
    await upsertToken('some-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    const error = (
      await listConnectedAccounts(githubProvider)
    )._unsafeUnwrapErr()

    expect(error).toEqual(new GithubApiError('server error'))
  })

  it('drops the token and returns no accounts when it was revoked on GitHub', async () => {
    await upsertToken('revoked-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad credentials', { status: 401 }),
    )

    expect(
      (await listConnectedAccounts(githubProvider))._unsafeUnwrap(),
    ).toEqual([])

    const [remainingToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    expect(remainingToken).toBeUndefined()
  })
})

describe('getIntegrationSummary', () => {
  it('reports configured true and no accounts when no token exists', async () => {
    expect(await getIntegrationSummary(githubProvider)).toEqual({
      id: 'github',
      displayName: 'GitHub',
      configured: true,
      supportsMultipleAccounts: false,
      accounts: [],
    })
  })

  it('reports configured false when environment variables are missing', async () => {
    clearEnv()

    expect(await getIntegrationSummary(githubProvider)).toEqual({
      id: 'github',
      displayName: 'GitHub',
      configured: false,
      supportsMultipleAccounts: false,
      accounts: [],
    })
  })

  it('reports the connected account with its login when a token exists', async () => {
    await upsertToken('valid-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ login: 'fohte' }), { status: 200 }),
    )

    const summary = await getIntegrationSummary(githubProvider)

    expect(normalizeSummary(summary)).toEqual({
      id: 'github',
      displayName: 'GitHub',
      configured: true,
      supportsMultipleAccounts: false,
      accounts: [{ id: 'ID', label: 'fohte' }],
    })
  })

  it('degrades to an empty accounts list instead of rejecting when the GitHub API call fails', async () => {
    await upsertToken('some-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    expect(await getIntegrationSummary(githubProvider)).toEqual({
      id: 'github',
      displayName: 'GitHub',
      configured: true,
      supportsMultipleAccounts: false,
      accounts: [],
    })
  })
})

describe('disconnectAccount', () => {
  it('deletes the stored token', async () => {
    const token = await upsertToken('valid-token')

    expect(
      (await disconnectAccount(githubProvider, token.id))._unsafeUnwrap(),
    ).toBe(true)

    const [remainingToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    expect(remainingToken).toBeUndefined()
  })

  it('resolves to false and deletes nothing for a nonexistent row id', async () => {
    await upsertToken('valid-token')

    expect(
      (
        await disconnectAccount(githubProvider, 'nonexistent-id')
      )._unsafeUnwrap(),
    ).toBe(false)

    const [remainingToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    expect(remainingToken).toBeDefined()
  })

  it('resolves to false and deletes nothing when the row belongs to a different provider', async () => {
    const token = await upsertToken('valid-token')

    expect(
      (
        await disconnectAccount(googleCalendarProvider, token.id)
      )._unsafeUnwrap(),
    ).toBe(false)

    const [remainingToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    expect(remainingToken).toBeDefined()
  })
})
