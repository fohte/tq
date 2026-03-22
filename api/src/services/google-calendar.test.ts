import { db } from '@api/db/connection'
import { oauthTokens } from '@api/db/schema'
import { setupTestDb } from '@api/testing'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

setupTestDb()

const MOCK_ENV = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/calendar/oauth-callback',
}

function setEnv() {
  for (const [key, value] of Object.entries(MOCK_ENV)) {
    process.env[key] = value
  }
}

function clearEnv() {
  for (const key of Object.keys(MOCK_ENV)) {
    delete process.env[key]
  }
}

async function upsertToken(values: {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}) {
  await db
    .insert(oauthTokens)
    .values({ provider: 'google_calendar', ...values })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { ...values, updatedAt: new Date() },
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
  return await import('@api/services/google-calendar')
}

describe('getAuthUrl', () => {
  it('returns a Google OAuth authorization URL with correct parameters', async () => {
    const { getAuthUrl } = await importService()

    const url = getAuthUrl()
    const parsed = new URL(url)

    expect(parsed.origin + parsed.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    )
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3001/api/calendar/oauth-callback',
    )
    expect(parsed.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/calendar.readonly',
    )
    expect(parsed.searchParams.get('access_type')).toBe('offline')
    expect(parsed.searchParams.get('response_type')).toBe('code')
  })

  it('throws when environment variables are missing', async () => {
    clearEnv()
    const { getAuthUrl } = await importService()

    expect(() => getAuthUrl()).toThrow('environment variables are required')
  })
})

describe('handleOAuthCallback', () => {
  it('exchanges code for tokens and saves them to the database', async () => {
    const { handleOAuthCallback } = await importService()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    )

    await handleOAuthCallback('auth-code-123')

    const [savedToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
      .limit(1)

    expect(savedToken).toEqual(
      expect.objectContaining({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    )
    expect(savedToken?.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('throws when token exchange fails', async () => {
    const { handleOAuthCallback } = await importService()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('invalid_grant', { status: 400 }),
    )

    await expect(handleOAuthCallback('bad-code')).rejects.toThrow(
      'Token exchange failed',
    )
  })
})

describe('refreshTokenIfNeeded', () => {
  it('returns existing token when not expired', async () => {
    const { refreshTokenIfNeeded } = await importService()

    await upsertToken({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const token = await refreshTokenIfNeeded()
    expect(token).toBe('valid-token')
  })

  it('refreshes token when close to expiry', async () => {
    const { refreshTokenIfNeeded } = await importService()

    await upsertToken({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 1000), // within 5-min buffer
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'refreshed-token',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    )

    const token = await refreshTokenIfNeeded()
    expect(token).toBe('refreshed-token')

    const [updated] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
      .limit(1)
    expect(updated).toEqual(
      expect.objectContaining({ accessToken: 'refreshed-token' }),
    )
  })

  it('throws OAuthTokenMissingError when no token exists', async () => {
    const { refreshTokenIfNeeded, OAuthTokenMissingError } =
      await importService()

    // Ensure no token exists by deleting any leftover
    await db
      .delete(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))

    await expect(refreshTokenIfNeeded()).rejects.toThrow(OAuthTokenMissingError)
  })

  it('throws when refresh request fails', async () => {
    const { refreshTokenIfNeeded } = await importService()

    await upsertToken({
      accessToken: 'expired-token',
      refreshToken: 'bad-refresh-token',
      expiresAt: new Date(Date.now() - 1000),
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('invalid_grant', { status: 400 }),
    )

    await expect(refreshTokenIfNeeded()).rejects.toThrow('Token refresh failed')
  })
})

describe('getEvents', () => {
  it('fetches and transforms Google Calendar events', async () => {
    const { getEvents } = await importService()

    await upsertToken({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'event-1',
              summary: 'Team standup',
              start: { dateTime: '2026-03-22T09:00:00Z' },
              end: { dateTime: '2026-03-22T09:30:00Z' },
            },
            {
              id: 'event-2',
              summary: 'All-day event',
              start: { date: '2026-03-22' },
              end: { date: '2026-03-23' },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const events = await getEvents(
      'primary',
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(events).toEqual([
      {
        id: 'event-1',
        summary: 'Team standup',
        startTime: '2026-03-22T09:00:00Z',
        endTime: '2026-03-22T09:30:00Z',
        isAllDay: false,
        source: 'google_calendar',
      },
      {
        id: 'event-2',
        summary: 'All-day event',
        startTime: '2026-03-22',
        endTime: '2026-03-23',
        isAllDay: true,
        source: 'google_calendar',
      },
    ])
  })

  it('handles events without summary', async () => {
    const { getEvents } = await importService()

    await upsertToken({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'event-no-title',
              start: { dateTime: '2026-03-22T10:00:00Z' },
              end: { dateTime: '2026-03-22T11:00:00Z' },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const events = await getEvents(
      'primary',
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(events).toEqual([expect.objectContaining({ summary: '(No title)' })])
  })
})
