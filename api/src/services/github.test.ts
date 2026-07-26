import { db } from '@api/db/connection'
import { oauthTokens } from '@api/db/schema'
import { assertDefined, setupTestDb } from '@api/testing'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  await db
    .insert(oauthTokens)
    .values({ provider: 'github', accessToken })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { accessToken, updatedAt: new Date() },
    })
}

beforeEach(() => {
  setEnv()
})

afterEach(() => {
  clearEnv()
  vi.restoreAllMocks()
})

// Dynamically import to allow env vars to be set before module evaluation
async function importService() {
  return await import('@api/services/github')
}

function normalize(token: typeof oauthTokens.$inferSelect) {
  return {
    ...token,
    id: 'ID',
    createdAt: 'DATE',
    updatedAt: 'DATE',
  }
}

describe('getAuthUrl', () => {
  it('returns a GitHub OAuth authorization URL with correct parameters', async () => {
    const { getAuthUrl } = await importService()

    const url = getAuthUrl()._unsafeUnwrap()
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

  it('returns a config error when environment variables are missing', async () => {
    clearEnv()
    const { getAuthUrl, GithubConfigError } = await importService()

    const error = getAuthUrl()._unsafeUnwrapErr()

    expect(error).toEqual(new GithubConfigError())
  })
})

describe('handleOAuthCallback', () => {
  it('exchanges code for a token and saves it to the database', async () => {
    const { handleOAuthCallback } = await importService()

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

    ;(await handleOAuthCallback('auth-code-123'))._unsafeUnwrap()

    const [savedToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    assertDefined(savedToken)

    expect(normalize(savedToken)).toEqual({
      id: 'ID',
      provider: 'github',
      accessToken: 'new-access-token',
      refreshToken: null,
      expiresAt: null,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns a token exchange error when the token endpoint returns a non-2xx response', async () => {
    const { handleOAuthCallback, TokenExchangeError } = await importService()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    const error = (await handleOAuthCallback('bad-code'))._unsafeUnwrapErr()

    expect(error).toEqual(new TokenExchangeError('server error'))
  })

  it('returns a rejected token exchange error when GitHub returns an error payload with 200 status', async () => {
    const { handleOAuthCallback, TokenExchangeError } = await importService()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        }),
        { status: 200 },
      ),
    )

    const error = (await handleOAuthCallback('bad-code'))._unsafeUnwrapErr()

    expect(error).toEqual(
      new TokenExchangeError(
        'The code passed is incorrect or expired.',
        undefined,
        true,
      ),
    )
  })
})

describe('getConnectionStatus', () => {
  it('returns not connected when no token exists', async () => {
    const { getConnectionStatus } = await importService()

    expect((await getConnectionStatus())._unsafeUnwrap()).toEqual({
      connected: false,
    })
  })

  it('returns connected with the account login when a token exists', async () => {
    const { getConnectionStatus } = await importService()

    await upsertToken('valid-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ login: 'fohte' }), { status: 200 }),
    )

    expect((await getConnectionStatus())._unsafeUnwrap()).toEqual({
      connected: true,
      login: 'fohte',
    })
  })

  it('returns a GitHub API error when the request fails', async () => {
    const { getConnectionStatus, GithubApiError } = await importService()

    await upsertToken('some-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    const error = (await getConnectionStatus())._unsafeUnwrapErr()

    expect(error).toEqual(new GithubApiError('server error'))
  })

  it('drops the token and returns not connected when it was revoked on GitHub', async () => {
    const { getConnectionStatus } = await importService()

    await upsertToken('revoked-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad credentials', { status: 401 }),
    )

    expect((await getConnectionStatus())._unsafeUnwrap()).toEqual({
      connected: false,
    })

    const [remainingToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    expect(remainingToken).toBeUndefined()
  })
})

describe('disconnect', () => {
  it('deletes the stored token', async () => {
    const { disconnect, getConnectionStatus } = await importService()

    await upsertToken('valid-token')
    ;(await disconnect())._unsafeUnwrap()

    expect((await getConnectionStatus())._unsafeUnwrap()).toEqual({
      connected: false,
    })
  })

  it('does nothing when no token exists', async () => {
    const { disconnect, getConnectionStatus } = await importService()

    ;(await disconnect())._unsafeUnwrap()

    expect((await getConnectionStatus())._unsafeUnwrap()).toEqual({
      connected: false,
    })
  })
})
