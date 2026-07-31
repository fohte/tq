import { and, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { calendarSubscriptions, oauthTokens } from '#db/schema'
import { upsertGoogleCalendarToken } from '#integrations/google-calendar/testing'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

const GITHUB_ENV = {
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_REDIRECT_URI: 'http://localhost:3001/api/github/oauth-callback',
}

const GOOGLE_ENV_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
]

function setGithubEnv() {
  for (const [key, value] of Object.entries(GITHUB_ENV)) {
    process.env[key] = value
  }
}

function clearGithubEnv() {
  for (const key of Object.keys(GITHUB_ENV)) {
    Reflect.deleteProperty(process.env, key)
  }
}

// Google Calendar is never configured in this file — its provider is only
// used here as "the other, unconfigured registry entry" — so its env vars
// are cleared explicitly rather than relying on them being ambiently unset.
function clearGoogleEnv() {
  for (const key of GOOGLE_ENV_KEYS) {
    Reflect.deleteProperty(process.env, key)
  }
}

async function upsertToken(provider: string, accessToken: string) {
  const [token] = await db
    .insert(oauthTokens)
    .values({ provider, accountId: '', accessToken })
    .onConflictDoUpdate({
      target: [oauthTokens.provider, oauthTokens.accountId],
      set: { accessToken, updatedAt: new Date() },
    })
    .returning()
  assertDefined(token)
  return token
}

// disconnectAccount takes oauthTokens.id (a surrogate key), which
// upsertGoogleCalendarToken doesn't return, so tests that need it re-select
// the row by the provider-specific accountId instead.
async function selectGoogleTokenByAccountId(accountId: string) {
  const [token] = await db
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.provider, 'google_calendar'),
        eq(oauthTokens.accountId, accountId),
      ),
    )
    .limit(1)
  assertDefined(token)
  return token
}

interface IntegrationEntry {
  id: string
  displayName: string
  configured: boolean
  supportsMultipleAccounts: boolean
  accounts: { id: string; label: string | null }[]
}

// Normalizes the surrogate row ids to a fixed placeholder (mirroring the
// normalize() helpers in the provider test files) and sorts accounts by
// label, since GET /api/integrations makes no promise about account order,
// so the full entry can still be asserted with a single toEqual despite the
// ids being unknown ahead of time.
function normalizeIntegrationEntry(entry: IntegrationEntry) {
  return {
    ...entry,
    accounts: entry.accounts
      .map((account) => ({ ...account, id: 'ID' }))
      .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '')),
  }
}

afterEach(() => {
  clearGithubEnv()
  clearGoogleEnv()
  vi.restoreAllMocks()
})

describe('GET /api/integrations', () => {
  it('lists every registered provider with its connected accounts and config state', async () => {
    setGithubEnv()
    clearGoogleEnv()
    const token = await upsertToken('github', 'valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ login: 'fohte' }), { status: 200 }),
    )

    const res = await app.request('/api/integrations')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: 'github',
        displayName: 'GitHub',
        configured: true,
        supportsMultipleAccounts: false,
        accounts: [{ id: token.id, label: 'fohte' }],
      },
      {
        id: 'google_calendar',
        displayName: 'Google Calendar',
        configured: false,
        supportsMultipleAccounts: true,
        accounts: [],
      },
    ])
  })

  it('degrades a single provider to an empty accounts list instead of failing the whole list', async () => {
    setGithubEnv()
    clearGoogleEnv()
    await upsertToken('github', 'some-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    const res = await app.request('/api/integrations')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: 'github',
        displayName: 'GitHub',
        configured: true,
        supportsMultipleAccounts: false,
        accounts: [],
      },
      {
        id: 'google_calendar',
        displayName: 'Google Calendar',
        configured: false,
        supportsMultipleAccounts: true,
        accounts: [],
      },
    ])
  })

  it('lists both accounts for a provider with multiple connected accounts', async () => {
    clearGithubEnv()
    clearGoogleEnv()
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user1@example.com',
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-2',
      accountLabel: 'user2@example.com',
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const res = await app.request('/api/integrations')
    expect(res.status).toBe(200)

    const body = await jsonBody<IntegrationEntry[]>(res)
    expect(body.map(normalizeIntegrationEntry)).toEqual([
      {
        id: 'github',
        displayName: 'GitHub',
        configured: false,
        supportsMultipleAccounts: false,
        accounts: [],
      },
      {
        id: 'google_calendar',
        displayName: 'Google Calendar',
        configured: false,
        supportsMultipleAccounts: true,
        accounts: [
          { id: 'ID', label: 'user1@example.com' },
          { id: 'ID', label: 'user2@example.com' },
        ],
      },
    ])
  })
})

describe('GET /api/integrations/:id/auth-url', () => {
  it('returns the authorization URL for a configured provider', async () => {
    setGithubEnv()

    const res = await app.request('/api/integrations/github/auth-url')

    expect(res.status).toBe(200)
    const { url } = await jsonBody<{ url: string }>(res)
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    )
  })

  it('returns 404 for an unregistered provider id', async () => {
    const res = await app.request('/api/integrations/unknown/auth-url')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })
})

describe('DELETE /api/integrations/:id/accounts/:accountId', () => {
  it('disconnects the targeted account only, leaving a sibling account for the same provider connected', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user1@example.com',
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-2',
      accountLabel: 'user2@example.com',
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const target = await selectGoogleTokenByAccountId('google-sub-1')

    const res = await app.request(
      `/api/integrations/google_calendar/accounts/${target.id}`,
      { method: 'DELETE' },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Disconnected' })

    const remaining = await db
      .select({ accountId: oauthTokens.accountId })
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
    expect(remaining).toEqual([{ accountId: 'google-sub-2' }])
  })

  it("cascades to delete the disconnected account's calendar subscriptions", async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user1@example.com',
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const target = await selectGoogleTokenByAccountId('google-sub-1')

    const res = await app.request(
      `/api/integrations/google_calendar/accounts/${target.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(200)

    const remainingSubscriptions = await db
      .select()
      .from(calendarSubscriptions)
      .where(eq(calendarSubscriptions.oauthTokenId, target.id))
    expect(remainingSubscriptions).toEqual([])
  })

  it('returns 404 for a nonexistent account id under a valid provider id', async () => {
    const res = await app.request(
      '/api/integrations/google_calendar/accounts/nonexistent-id',
      { method: 'DELETE' },
    )

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })

  it('returns 404 for an unregistered provider id', async () => {
    const res = await app.request(
      '/api/integrations/unknown/accounts/some-id',
      { method: 'DELETE' },
    )

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })

  it('returns 404 when the account id belongs to a different provider than the one in the path', async () => {
    const token = await upsertToken('github', 'valid-token')

    const res = await app.request(
      `/api/integrations/google_calendar/accounts/${token.id}`,
      { method: 'DELETE' },
    )

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })

    const [remaining] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    expect(remaining).toBeDefined()
  })
})
