import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import {
  getEvents,
  googleCalendarProvider,
} from '#integrations/google-calendar/index'
import {
  disconnect,
  getAuthUrl,
  getConnectionStatus,
  getIntegrationSummary,
  getValidAccessToken,
  handleOAuthCallback,
} from '#integrations/oauth'
import { TokenExchangeError } from '#lib/fetch-json'
import { assertDefined, setupTestDb } from '#testing'

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
    Reflect.deleteProperty(process.env, key)
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

// Replaces dynamic fields with fixed placeholders so the full row can still
// be asserted with a single `toEqual`. `expiresAt` only normalizes when it's
// strictly after `expiresAfter`, so a stale/missing expiry still fails the
// comparison instead of silently passing.
function normalize(
  token: typeof oauthTokens.$inferSelect,
  expiresAfter: number,
) {
  return {
    ...token,
    id: 'ID',
    createdAt: 'DATE',
    updatedAt: 'DATE',
    expiresAt:
      token.expiresAt != null && token.expiresAt.getTime() > expiresAfter
        ? 'FUTURE'
        : token.expiresAt,
  }
}

beforeEach(() => {
  setEnv()
})

afterEach(() => {
  clearEnv()
  vi.restoreAllMocks()
})

describe('getAuthUrl', () => {
  it('returns a Google OAuth authorization URL with correct parameters', () => {
    const url = getAuthUrl(googleCalendarProvider)._unsafeUnwrap()
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

  it('returns a config error when environment variables are missing', () => {
    clearEnv()

    const error = getAuthUrl(googleCalendarProvider)._unsafeUnwrapErr()

    expect(error).toEqual(
      new IntegrationConfigError(
        'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables are required',
      ),
    )
  })
})

describe('handleOAuthCallback', () => {
  it('exchanges code for tokens and saves them to the database', async () => {
    const beforeCall = Date.now()

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

    ;(
      await handleOAuthCallback(googleCalendarProvider, 'auth-code-123')
    )._unsafeUnwrap()

    const [savedToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
      .limit(1)
    assertDefined(savedToken)

    expect(normalize(savedToken, beforeCall)).toEqual({
      id: 'ID',
      provider: 'google_calendar',
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 'FUTURE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns a token exchange error when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('invalid_grant', { status: 400 }),
    )

    const error = (
      await handleOAuthCallback(googleCalendarProvider, 'bad-code')
    )._unsafeUnwrapErr()

    expect(error).toEqual(
      new TokenExchangeError('invalid_grant', undefined, true),
    )
  })
})

describe('getValidAccessToken', () => {
  it('returns existing token when not expired', async () => {
    await upsertToken({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const token = (
      await getValidAccessToken(googleCalendarProvider)
    )._unsafeUnwrap()
    expect(token).toBe('valid-token')
  })

  it('refreshes token when close to expiry', async () => {
    await upsertToken({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 1000), // within 5-min buffer
    })

    const beforeCall = Date.now()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'refreshed-token',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    )

    const token = (
      await getValidAccessToken(googleCalendarProvider)
    )._unsafeUnwrap()
    expect(token).toBe('refreshed-token')

    const [updated] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
      .limit(1)
    assertDefined(updated)

    expect(normalize(updated, beforeCall)).toEqual({
      id: 'ID',
      provider: 'google_calendar',
      accessToken: 'refreshed-token',
      refreshToken: 'refresh-token',
      expiresAt: 'FUTURE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('persists rotated refresh token when Google returns one', async () => {
    await upsertToken({
      accessToken: 'old-token',
      refreshToken: 'old-refresh-token',
      expiresAt: new Date(Date.now() - 1000),
    })

    const beforeCall = Date.now()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'rotated-refresh-token',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    )

    ;(await getValidAccessToken(googleCalendarProvider))._unsafeUnwrap()

    const [updated] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
      .limit(1)
    assertDefined(updated)

    expect(normalize(updated, beforeCall)).toEqual({
      id: 'ID',
      provider: 'google_calendar',
      accessToken: 'new-access',
      refreshToken: 'rotated-refresh-token',
      expiresAt: 'FUTURE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns OAuthTokenMissingError when no token exists', async () => {
    const error = (
      await getValidAccessToken(googleCalendarProvider)
    )._unsafeUnwrapErr()

    expect(error).toEqual(new OAuthTokenMissingError())
  })

  it('marks the error as rejected when Google reports the refresh token as invalid_grant', async () => {
    await upsertToken({
      accessToken: 'expired-token',
      refreshToken: 'bad-refresh-token',
      expiresAt: new Date(Date.now() - 1000),
    })

    const body = JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Bad Request',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(body, { status: 400 }),
    )

    const error = (
      await getValidAccessToken(googleCalendarProvider)
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenRefreshError(body, undefined, true))
  })

  it('does not mark the error as rejected when Google reports an OAuth error other than invalid_grant', async () => {
    await upsertToken({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() - 1000),
    })

    const body = JSON.stringify({
      error: 'invalid_client',
      error_description: 'Unauthorized',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(body, { status: 400 }),
    )

    const error = (
      await getValidAccessToken(googleCalendarProvider)
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenRefreshError(body, undefined, false))
  })

  it('does not mark the error as rejected when the request fails with a server error', async () => {
    await upsertToken({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() - 1000),
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('internal error', { status: 500 }),
    )

    const error = (
      await getValidAccessToken(googleCalendarProvider)
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenRefreshError('internal error'))
  })
})

describe('getConnectionStatus / disconnect', () => {
  it('reports connected without a live check once a token exists', async () => {
    await upsertToken({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    expect(
      (await getConnectionStatus(googleCalendarProvider))._unsafeUnwrap(),
    ).toEqual({
      connected: true,
    })
  })

  it('reports not connected when no token exists', async () => {
    expect(
      (await getConnectionStatus(googleCalendarProvider))._unsafeUnwrap(),
    ).toEqual({
      connected: false,
    })
  })

  it('deletes the stored token on disconnect', async () => {
    await upsertToken({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    ;(await disconnect(googleCalendarProvider))._unsafeUnwrap()

    expect(
      (await getConnectionStatus(googleCalendarProvider))._unsafeUnwrap(),
    ).toEqual({
      connected: false,
    })
  })
})

describe('getIntegrationSummary', () => {
  it('reports configured true and connected false when no token exists', async () => {
    expect(await getIntegrationSummary(googleCalendarProvider)).toEqual({
      id: 'google_calendar',
      displayName: 'Google Calendar',
      configured: true,
      connected: false,
    })
  })

  it('reports configured false when environment variables are missing', async () => {
    clearEnv()

    expect(await getIntegrationSummary(googleCalendarProvider)).toEqual({
      id: 'google_calendar',
      displayName: 'Google Calendar',
      configured: false,
      connected: false,
    })
  })

  it('reports connected true once a token exists', async () => {
    await upsertToken({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    expect(await getIntegrationSummary(googleCalendarProvider)).toEqual({
      id: 'google_calendar',
      displayName: 'Google Calendar',
      configured: true,
      connected: true,
    })
  })
})

describe('getEvents', () => {
  it('fetches and transforms Google Calendar events', async () => {
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

    const events = (
      await getEvents('primary', '2026-03-22T00:00:00Z', '2026-03-23T00:00:00Z')
    )._unsafeUnwrap()

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

    const events = (
      await getEvents('primary', '2026-03-22T00:00:00Z', '2026-03-23T00:00:00Z')
    )._unsafeUnwrap()

    expect(events).toEqual([
      {
        id: 'event-no-title',
        summary: '(No title)',
        startTime: '2026-03-22T10:00:00Z',
        endTime: '2026-03-22T11:00:00Z',
        isAllDay: false,
        source: 'google_calendar',
      },
    ])
  })
})
