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

    const url = getAuthUrl()
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

  it('throws when environment variables are missing', async () => {
    clearEnv()
    const { getAuthUrl } = await importService()

    expect(() => getAuthUrl()).toThrow('environment variables are required')
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

    await handleOAuthCallback('auth-code-123')

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

  it('throws when the token endpoint returns a non-2xx response', async () => {
    const { handleOAuthCallback } = await importService()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    await expect(handleOAuthCallback('bad-code')).rejects.toThrow(
      'Token exchange failed',
    )
  })

  it('throws when GitHub returns an error payload with 200 status', async () => {
    const { handleOAuthCallback } = await importService()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        }),
        { status: 200 },
      ),
    )

    await expect(handleOAuthCallback('bad-code')).rejects.toThrow(
      'The code passed is incorrect or expired.',
    )
  })
})

describe('getConnectionStatus', () => {
  it('returns not connected when no token exists', async () => {
    const { getConnectionStatus } = await importService()

    expect(await getConnectionStatus()).toEqual({ connected: false })
  })

  it('returns connected with the account login when a token exists', async () => {
    const { getConnectionStatus } = await importService()

    await upsertToken('valid-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ login: 'fohte' }), { status: 200 }),
    )

    expect(await getConnectionStatus()).toEqual({
      connected: true,
      login: 'fohte',
    })
  })

  it('throws when the GitHub API request fails', async () => {
    const { getConnectionStatus } = await importService()

    await upsertToken('some-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    await expect(getConnectionStatus()).rejects.toThrow('GitHub API error')
  })

  it('drops the token and returns not connected when it was revoked on GitHub', async () => {
    const { getConnectionStatus } = await importService()

    await upsertToken('revoked-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad credentials', { status: 401 }),
    )

    expect(await getConnectionStatus()).toEqual({ connected: false })

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
    await disconnect()

    expect(await getConnectionStatus()).toEqual({ connected: false })
  })

  it('does nothing when no token exists', async () => {
    const { disconnect } = await importService()

    await expect(disconnect()).resolves.toBeUndefined()
  })
})
