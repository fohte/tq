import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { calendarSubscriptions, oauthTokens } from '#db/schema'
import {
  AccountIdentityError,
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import {
  type AccountEventsResult,
  CalendarApiError,
  getEvents,
  googleCalendarProvider,
} from '#integrations/google-calendar/index'
import { upsertGoogleCalendarToken } from '#integrations/google-calendar/testing'
import {
  disconnectAccount,
  getAuthUrl,
  getIntegrationSummary,
  getValidAccessToken,
  handleOAuthCallback,
  listConnectedAccounts,
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

// Unwraps each account's neverthrow Result into a plain value so the whole
// array (a mix of successful accounts and failed ones) can still be
// asserted with a single `toEqual`, and sorts by accountId (and, within a
// successful account, by event id) since listAccountTokens/getEvents and the
// per-calendar fan-out in getSubscribedCalendarEvents make no promise about
// row order.
function normalizeAccountResults(results: AccountEventsResult[]) {
  return results
    .map((r) => ({
      accountId: r.accountId,
      accountLabel: r.accountLabel,
      ok: r.result.isOk(),
      value: r.result.match(
        (events) => [...events].sort((a, b) => a.id.localeCompare(b.id)),
        (error) => error,
      ),
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId))
}

// Replaces the surrogate row id with a fixed placeholder, same idea as
// normalize() above, so an IntegrationAccount[] can still be asserted with a
// single toEqual.
function normalizeAccounts(accounts: { id: string; label: string | null }[]) {
  return accounts.map((account) => ({ ...account, id: 'ID' }))
}

// Also sorts accounts by label since getIntegrationSummary makes no promise
// about account order.
function normalizeSummary(
  summary: Awaited<ReturnType<typeof getIntegrationSummary>>,
) {
  return {
    ...summary,
    accounts: normalizeAccounts(summary.accounts).sort((a, b) =>
      (a.label ?? '').localeCompare(b.label ?? ''),
    ),
  }
}

// fetch's first parameter can be a Request, which has no meaningful
// `toString()`, so this narrows to the cases fetchJson actually calls fetch
// with (a plain URL string) or could (a URL/Request instance) instead of
// stringifying `input` directly.
function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

// disconnectAccount takes oauthTokens.id (a surrogate key), which
// upsertGoogleCalendarToken doesn't return, so tests that need it re-select
// the row by the provider-specific accountId instead.
async function selectTokenByAccountId(accountId: string) {
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
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      client_id: 'test-client-id',
      redirect_uri: 'http://localhost:3001/api/calendar/oauth-callback',
      scope: 'https://www.googleapis.com/auth/calendar.readonly openid email',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'select_account consent',
    })
  })

  it('returns a config error when environment variables are missing', () => {
    clearEnv()

    const error = getAuthUrl(googleCalendarProvider)._unsafeUnwrapErr()

    expect(error).toEqual(
      new IntegrationConfigError(
        'invalid environment:\n' +
          '- missing required environment variable: GOOGLE_CLIENT_ID\n' +
          '- missing required environment variable: GOOGLE_CLIENT_SECRET\n' +
          '- missing required environment variable: GOOGLE_REDIRECT_URI',
      ),
    )
  })
})

describe('handleOAuthCallback', () => {
  it('exchanges code for tokens and identifies the account, saving both to the database', async () => {
    const beforeCall = Date.now()

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sub: 'google-sub-1', email: 'user@example.com' }),
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
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
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

  it('discards the exchanged token when identifying the account fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))

    const error = (
      await handleOAuthCallback(googleCalendarProvider, 'auth-code-123')
    )._unsafeUnwrapErr()

    expect(error).toBeInstanceOf(AccountIdentityError)

    const savedTokens = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
    expect(savedTokens).toEqual([])
  })

  it('connecting a second account does not overwrite the first', async () => {
    const beforeCall = Date.now()

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-token-1',
            refresh_token: 'refresh-token-1',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sub: 'google-sub-1', email: 'user1@example.com' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-token-2',
            refresh_token: 'refresh-token-2',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sub: 'google-sub-2', email: 'user2@example.com' }),
          { status: 200 },
        ),
      )

    ;(
      await handleOAuthCallback(googleCalendarProvider, 'auth-code-1')
    )._unsafeUnwrap()
    ;(
      await handleOAuthCallback(googleCalendarProvider, 'auth-code-2')
    )._unsafeUnwrap()

    const savedTokens = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))

    expect(
      savedTokens
        .map((token) => normalize(token, beforeCall))
        .sort((a, b) => a.accountId.localeCompare(b.accountId)),
    ).toEqual([
      {
        id: 'ID',
        provider: 'google_calendar',
        accountId: 'google-sub-1',
        accountLabel: 'user1@example.com',
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
        expiresAt: 'FUTURE',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
      {
        id: 'ID',
        provider: 'google_calendar',
        accountId: 'google-sub-2',
        accountLabel: 'user2@example.com',
        accessToken: 'access-token-2',
        refreshToken: 'refresh-token-2',
        expiresAt: 'FUTURE',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })
})

describe('getValidAccessToken', () => {
  it('returns existing token when not expired', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const token = (
      await getValidAccessToken(googleCalendarProvider, 'google-sub-1')
    )._unsafeUnwrap()
    expect(token).toBe('valid-token')
  })

  it('refreshes token when close to expiry', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
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
      await getValidAccessToken(googleCalendarProvider, 'google-sub-1')
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
      accountId: 'google-sub-1',
      accountLabel: null,
      accessToken: 'refreshed-token',
      refreshToken: 'refresh-token',
      expiresAt: 'FUTURE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('persists rotated refresh token when Google returns one', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
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

    ;(
      await getValidAccessToken(googleCalendarProvider, 'google-sub-1')
    )._unsafeUnwrap()

    const [updated] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))
      .limit(1)
    assertDefined(updated)

    expect(normalize(updated, beforeCall)).toEqual({
      id: 'ID',
      provider: 'google_calendar',
      accountId: 'google-sub-1',
      accountLabel: null,
      accessToken: 'new-access',
      refreshToken: 'rotated-refresh-token',
      expiresAt: 'FUTURE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns OAuthTokenMissingError when no token exists', async () => {
    const error = (
      await getValidAccessToken(googleCalendarProvider, 'google-sub-1')
    )._unsafeUnwrapErr()

    expect(error).toEqual(new OAuthTokenMissingError())
  })

  it('marks the error as rejected when Google reports the refresh token as invalid_grant', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
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
      await getValidAccessToken(googleCalendarProvider, 'google-sub-1')
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenRefreshError(body, undefined, true))
  })

  it('does not mark the error as rejected when Google reports an OAuth error other than invalid_grant', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
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
      await getValidAccessToken(googleCalendarProvider, 'google-sub-1')
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenRefreshError(body, undefined, false))
  })

  it('does not mark the error as rejected when the request fails with a server error', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() - 1000),
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('internal error', { status: 500 }),
    )

    const error = (
      await getValidAccessToken(googleCalendarProvider, 'google-sub-1')
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenRefreshError('internal error'))
  })
})

describe('listConnectedAccounts', () => {
  it('returns no accounts when no token exists', async () => {
    expect(
      (await listConnectedAccounts(googleCalendarProvider))._unsafeUnwrap(),
    ).toEqual([])
  })

  it('returns the stored account without a live check once a token exists', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const accounts = (
      await listConnectedAccounts(googleCalendarProvider)
    )._unsafeUnwrap()

    expect(normalizeAccounts(accounts)).toEqual([
      { id: 'ID', label: 'user@example.com' },
    ])
  })
})

describe('disconnectAccount', () => {
  it('deletes the targeted account and leaves the sibling account connected', async () => {
    const beforeCall = Date.now()

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
    const target = await selectTokenByAccountId('google-sub-1')

    expect(
      (
        await disconnectAccount(googleCalendarProvider, target.id)
      )._unsafeUnwrap(),
    ).toBe(true)

    const remaining = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_calendar'))

    expect(remaining.map((token) => normalize(token, beforeCall))).toEqual([
      {
        id: 'ID',
        provider: 'google_calendar',
        accountId: 'google-sub-2',
        accountLabel: 'user2@example.com',
        accessToken: 'access-token-2',
        refreshToken: 'refresh-token-2',
        expiresAt: 'FUTURE',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })
})

describe('getIntegrationSummary', () => {
  it('reports configured true and no accounts when no token exists', async () => {
    expect(await getIntegrationSummary(googleCalendarProvider)).toEqual({
      id: 'google_calendar',
      displayName: 'Google Calendar',
      configured: true,
      supportsMultipleAccounts: true,
      accounts: [],
    })
  })

  it('reports configured false when environment variables are missing', async () => {
    clearEnv()

    expect(await getIntegrationSummary(googleCalendarProvider)).toEqual({
      id: 'google_calendar',
      displayName: 'Google Calendar',
      configured: false,
      supportsMultipleAccounts: true,
      accounts: [],
    })
  })

  it('reports the connected account once a token exists', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const summary = await getIntegrationSummary(googleCalendarProvider)

    expect(normalizeSummary(summary)).toEqual({
      id: 'google_calendar',
      displayName: 'Google Calendar',
      configured: true,
      supportsMultipleAccounts: true,
      accounts: [{ id: 'ID', label: null }],
    })
  })

  it('reports both accounts when two are connected', async () => {
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

    const summary = await getIntegrationSummary(googleCalendarProvider)

    expect(normalizeSummary(summary)).toEqual({
      id: 'google_calendar',
      displayName: 'Google Calendar',
      configured: true,
      supportsMultipleAccounts: true,
      accounts: [
        { id: 'ID', label: 'user1@example.com' },
        { id: 'ID', label: 'user2@example.com' },
      ],
    })
  })
})

describe('getEvents', () => {
  it('fetches and transforms Google Calendar events', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
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

    const results = await getEvents(
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(normalizeAccountResults(results)).toEqual([
      {
        accountId: 'google-sub-1',
        accountLabel: 'user@example.com',
        ok: true,
        value: [
          {
            id: 'event-1',
            summary: 'Team standup',
            startTime: '2026-03-22T09:00:00Z',
            endTime: '2026-03-22T09:30:00Z',
            isAllDay: false,
            source: 'google_calendar',
            accountId: 'google-sub-1',
            accountLabel: 'user@example.com',
            calendarId: 'user@example.com',
            calendarDisplayName: null,
            calendarColor: null,
          },
          {
            id: 'event-2',
            summary: 'All-day event',
            startTime: '2026-03-22',
            endTime: '2026-03-23',
            isAllDay: true,
            source: 'google_calendar',
            accountId: 'google-sub-1',
            accountLabel: 'user@example.com',
            calendarId: 'user@example.com',
            calendarDisplayName: null,
            calendarColor: null,
          },
        ],
      },
    ])
  })

  it('handles events without summary', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
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

    const results = await getEvents(
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(normalizeAccountResults(results)).toEqual([
      {
        accountId: 'google-sub-1',
        accountLabel: 'user@example.com',
        ok: true,
        value: [
          {
            id: 'event-no-title',
            summary: '(No title)',
            startTime: '2026-03-22T10:00:00Z',
            endTime: '2026-03-22T11:00:00Z',
            isAllDay: false,
            source: 'google_calendar',
            accountId: 'google-sub-1',
            accountLabel: 'user@example.com',
            calendarId: 'user@example.com',
            calendarDisplayName: null,
            calendarColor: null,
          },
        ],
      },
    ])
  })

  it("keeps a working account's events when a different connected account fails", async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user1@example.com',
      accessToken: 'valid-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-2',
      accountLabel: 'user2@example.com',
      accessToken: 'valid-token-2',
      refreshToken: 'refresh-token-2',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    // Keyed by the request's Authorization header rather than call order,
    // since listAccountTokens/getEvents make no promise about which
    // account's request goes out first.
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      const authorization = new Headers(init?.headers).get('Authorization')
      if (authorization === 'Bearer valid-token-1') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'event-1',
                  summary: 'Team standup',
                  start: { dateTime: '2026-03-22T09:00:00Z' },
                  end: { dateTime: '2026-03-22T09:30:00Z' },
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      if (authorization === 'Bearer valid-token-2') {
        return Promise.resolve(new Response('server error', { status: 500 }))
      }
      throw new Error(
        `unexpected fetch in test: Authorization=${String(authorization)}`,
      )
    })

    const results = await getEvents(
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(normalizeAccountResults(results)).toEqual([
      {
        accountId: 'google-sub-1',
        accountLabel: 'user1@example.com',
        ok: true,
        value: [
          {
            id: 'event-1',
            summary: 'Team standup',
            startTime: '2026-03-22T09:00:00Z',
            endTime: '2026-03-22T09:30:00Z',
            isAllDay: false,
            source: 'google_calendar',
            accountId: 'google-sub-1',
            accountLabel: 'user1@example.com',
            calendarId: 'user1@example.com',
            calendarDisplayName: null,
            calendarColor: null,
          },
        ],
      },
      {
        accountId: 'google-sub-2',
        accountLabel: 'user2@example.com',
        ok: false,
        value: new CalendarApiError('server error'),
      },
    ])
  })

  it('fetches events from every calendar the account is subscribed to, tagging each with its calendarId and subscription snapshot', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const token = await selectTokenByAccountId('google-sub-1')
    await db.insert(calendarSubscriptions).values({
      oauthTokenId: token.id,
      calendarId: 'work@example.com',
      displayName: 'Work',
      color: '#ff0000',
    })

    // Keyed by the request URL's calendarId path segment rather than call
    // order, since ResultAsync.combine makes no promise about which
    // subscribed calendar's request goes out first.
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes('/calendars/user%40example.com/events')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'event-1',
                  summary: 'Standup',
                  start: { dateTime: '2026-03-22T09:00:00Z' },
                  end: { dateTime: '2026-03-22T09:30:00Z' },
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      if (url.includes('/calendars/work%40example.com/events')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'event-2',
                  summary: 'Planning',
                  start: { dateTime: '2026-03-22T14:00:00Z' },
                  end: { dateTime: '2026-03-22T14:30:00Z' },
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      throw new Error(`unexpected fetch in test: url=${url}`)
    })

    const results = await getEvents(
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(normalizeAccountResults(results)).toEqual([
      {
        accountId: 'google-sub-1',
        accountLabel: 'user@example.com',
        ok: true,
        value: [
          {
            id: 'event-1',
            summary: 'Standup',
            startTime: '2026-03-22T09:00:00Z',
            endTime: '2026-03-22T09:30:00Z',
            isAllDay: false,
            source: 'google_calendar',
            accountId: 'google-sub-1',
            accountLabel: 'user@example.com',
            calendarId: 'user@example.com',
            calendarDisplayName: null,
            calendarColor: null,
          },
          {
            id: 'event-2',
            summary: 'Planning',
            startTime: '2026-03-22T14:00:00Z',
            endTime: '2026-03-22T14:30:00Z',
            isAllDay: false,
            source: 'google_calendar',
            accountId: 'google-sub-1',
            accountLabel: 'user@example.com',
            calendarId: 'work@example.com',
            calendarDisplayName: 'Work',
            calendarColor: '#ff0000',
          },
        ],
      },
    ])
  })

  it("keeps a subscribed calendar's events when a sibling calendar for the same account fails", async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const token = await selectTokenByAccountId('google-sub-1')
    await db.insert(calendarSubscriptions).values({
      oauthTokenId: token.id,
      calendarId: 'work@example.com',
      displayName: 'Work',
      color: '#ff0000',
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes('/calendars/user%40example.com/events')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'event-1',
                  summary: 'Standup',
                  start: { dateTime: '2026-03-22T09:00:00Z' },
                  end: { dateTime: '2026-03-22T09:30:00Z' },
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      if (url.includes('/calendars/work%40example.com/events')) {
        return Promise.resolve(new Response('server error', { status: 500 }))
      }
      throw new Error(`unexpected fetch in test: url=${url}`)
    })

    const results = await getEvents(
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(normalizeAccountResults(results)).toEqual([
      {
        accountId: 'google-sub-1',
        accountLabel: 'user@example.com',
        ok: true,
        value: [
          {
            id: 'event-1',
            summary: 'Standup',
            startTime: '2026-03-22T09:00:00Z',
            endTime: '2026-03-22T09:30:00Z',
            isAllDay: false,
            source: 'google_calendar',
            accountId: 'google-sub-1',
            accountLabel: 'user@example.com',
            calendarId: 'user@example.com',
            calendarDisplayName: null,
            calendarColor: null,
          },
        ],
      },
    ])
  })

  it('resolves to zero events for an account with zero subscribed calendars, instead of falling back to its primary calendar', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const token = await selectTokenByAccountId('google-sub-1')
    // Removes the default-calendar subscription that upsertGoogleCalendarToken
    // auto-seeds, leaving the account with an oauth_tokens row but zero
    // calendar_subscriptions rows.
    await db
      .delete(calendarSubscriptions)
      .where(eq(calendarSubscriptions.oauthTokenId, token.id))

    // No calendar to fetch means getEvents must not call fetch at all.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const results = await getEvents(
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(normalizeAccountResults(results)).toEqual([
      {
        accountId: 'google-sub-1',
        accountLabel: 'user@example.com',
        ok: true,
        value: [],
      },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('resolves the account as failed when every one of its subscribed calendars fails', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user@example.com',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const token = await selectTokenByAccountId('google-sub-1')
    await db.insert(calendarSubscriptions).values({
      oauthTokenId: token.id,
      calendarId: 'work@example.com',
      displayName: 'Work',
      color: '#ff0000',
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('server error', { status: 500 }),
    )

    const results = await getEvents(
      '2026-03-22T00:00:00Z',
      '2026-03-23T00:00:00Z',
    )

    expect(normalizeAccountResults(results)).toEqual([
      {
        accountId: 'google-sub-1',
        accountLabel: 'user@example.com',
        ok: false,
        value: new CalendarApiError('server error'),
      },
    ])
  })
})
